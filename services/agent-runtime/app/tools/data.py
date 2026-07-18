import csv
import json
from io import StringIO
from time import perf_counter
from typing import Any

from app.models import DataAnomaly, DataInput, DataMetric, ToolDefinition

DATA_TOOLS = [
    ToolDefinition(
        id="table-reader",
        name="Table reader",
        description="Parse approved CSV or JSON tables for the current run",
        risk="low",
    ),
    ToolDefinition(
        id="data-profiler",
        name="Data profiler",
        description="Identify columns, row counts, missing values, and numeric fields",
        risk="low",
    ),
    ToolDefinition(
        id="calculation-tool",
        name="Calculation tool",
        description="Calculate deterministic summary metrics for numeric columns",
        risk="low",
    ),
    ToolDefinition(
        id="anomaly-detector",
        name="Anomaly detector",
        description="Flag numeric outliers using a transparent IQR rule",
        risk="low",
    ),
]

REQUIRED_DATA_TOOL_IDS = {tool.id for tool in DATA_TOOLS}


def _parse_csv(content: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(StringIO(content))
    if not reader.fieldnames or any(not field for field in reader.fieldnames):
        raise ValueError("CSV requires a non-empty header row.")
    return [dict(row) for row in reader]


def _parse_json(content: str) -> list[dict[str, Any]]:
    payload = json.loads(content)
    if not isinstance(payload, list) or not all(isinstance(row, dict) for row in payload):
        raise ValueError("JSON data must be an array of objects.")
    return payload


def sandbox_table_reader(
    datasets: list[DataInput],
) -> tuple[list[dict[str, Any]], list[str], int]:
    started = perf_counter()
    rows: list[dict[str, Any]] = []
    errors: list[str] = []
    for dataset in datasets:
        try:
            parsed = (
                _parse_csv(dataset.content)
                if dataset.mimeType == "text/csv"
                else _parse_json(dataset.content)
            )
            if not parsed:
                raise ValueError("The table has no data rows.")
            rows.extend(parsed)
        except (ValueError, json.JSONDecodeError, csv.Error) as error:
            errors.append(f"{dataset.name}: {error}")
    if len(rows) > 500:
        errors.append("Only the first 500 rows were analyzed in this milestone.")
        rows = rows[:500]
    return rows, errors, max(1, round((perf_counter() - started) * 1_000))


def _to_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        return float(value)
    cleaned = str(value).strip().replace(",", "").replace("$", "").replace("%", "")
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def sandbox_data_profiler(
    rows: list[dict[str, Any]],
) -> tuple[list[str], list[str], dict[str, int], int]:
    started = perf_counter()
    columns = list(dict.fromkeys(key for row in rows for key in row))
    missing = {
        column: sum(1 for row in rows if row.get(column) in (None, "")) for column in columns
    }
    numeric_columns: list[str] = []
    for column in columns:
        present = [row.get(column) for row in rows if row.get(column) not in (None, "")]
        numeric = [value for value in present if _to_float(value) is not None]
        if present and len(numeric) / len(present) >= 0.8:
            numeric_columns.append(column)
    return columns, numeric_columns, missing, max(1, round((perf_counter() - started) * 1_000))


def sandbox_calculation_tool(
    rows: list[dict[str, Any]], numeric_columns: list[str]
) -> tuple[list[DataMetric], int]:
    started = perf_counter()
    metrics: list[DataMetric] = []
    for column in numeric_columns[:6]:
        values = [value for row in rows if (value := _to_float(row.get(column))) is not None]
        if not values:
            continue
        metrics.extend(
            [
                DataMetric(column=column, operation="sum", value=round(sum(values), 4)),
                DataMetric(
                    column=column,
                    operation="average",
                    value=round(sum(values) / len(values), 4),
                ),
                DataMetric(column=column, operation="minimum", value=round(min(values), 4)),
                DataMetric(column=column, operation="maximum", value=round(max(values), 4)),
            ]
        )
    return metrics, max(1, round((perf_counter() - started) * 1_000))


def _percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def sandbox_anomaly_detector(
    rows: list[dict[str, Any]], numeric_columns: list[str]
) -> tuple[list[DataAnomaly], int]:
    started = perf_counter()
    anomalies: list[DataAnomaly] = []
    for column in numeric_columns[:6]:
        values = [value for row in rows if (value := _to_float(row.get(column))) is not None]
        if len(values) < 4:
            continue
        first_quartile = _percentile(values, 0.25)
        third_quartile = _percentile(values, 0.75)
        spread = third_quartile - first_quartile
        lower_bound = first_quartile - 1.5 * spread
        upper_bound = third_quartile + 1.5 * spread
        for index, row in enumerate(rows, start=1):
            value = _to_float(row.get(column))
            if value is not None and (value < lower_bound or value > upper_bound):
                anomalies.append(
                    DataAnomaly(
                        rowNumber=index,
                        column=column,
                        value=value,
                        reason=(
                            f"Outside IQR range {round(lower_bound, 4)} to {round(upper_bound, 4)}"
                        ),
                    )
                )
    return anomalies[:20], max(1, round((perf_counter() - started) * 1_000))
