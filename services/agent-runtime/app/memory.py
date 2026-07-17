from dataclasses import dataclass, field
from typing import Protocol


class LongTermMemoryStore(Protocol):
    """Boundary for a future governed store, including an optional LangMem adapter."""

    def search(self, *, namespace: str, query: str, limit: int = 5) -> list[str]: ...

    def remember(self, *, namespace: str, facts: list[str]) -> None: ...


@dataclass
class RunWorkingMemory:
    """Transient memory for one run; durable thread state belongs to the checkpointer."""

    seed: str = ""
    notes: list[str] = field(default_factory=list)

    def add(self, note: str) -> None:
        if note and note not in self.notes:
            self.notes.append(note)

    def snapshot(self) -> str:
        return "\n".join(part for part in [self.seed, *self.notes] if part)
