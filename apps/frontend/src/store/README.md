# Gemeinsamer Client-State

Hier ist derzeit kein Store implementiert. `nanostores` ist als Abhängigkeit
vorhanden; React, TanStack Query und Framework-Store-Hooks werden nicht verwendet.

Einfache Zustände bleiben in den jeweiligen Vanilla-Scripts. Einen gemeinsamen
Store erst ergänzen, wenn mehrere Komponenten denselben Zustand benötigen. Keine
zusätzliche Framework- oder Datenabfrageschicht ohne konkreten Bedarf einführen.

[Frontend-README](../../README.md) · [Projektregeln](../../../../AGENTS.md)
