# Product Decisions & Domain Policies (Phase 0)

## 1. Core Policies Locked

| Decision Area | Approved Policy | Rationale |
|---|---|---|
| **Account Creation** | Admin-provisioned accounts in V1. Admin creates student and admin logins with temporary credentials. | Prevents fake signups, spam, and keeps student ID mapping strictly verified. |
| **Student Identifier** | College Student ID (e.g. `2024BCSE042`), Full Name, and optional Email. | College ID is the primary authoritative key across departments and lab logs. |
| **Stock Change Timing** | Stock changes **only** upon physical issue / handover, never at request or approval time. | Prevents ghost stock locks when approved students delay or fail to collect components. |
| **Stock Tracking Modes** | Dual-track: `SERIALIZED` (individual units with asset codes like `ARD-001`, `RPI-004`) vs `BULK` (quantity-tracked like jumper wires, screws, LEDs). | Avoids tedious asset-tagging of pennies-cost consumables while protecting expensive dev boards and instruments. |
| **Consumables vs Returnables** | `RETURNABLE` items expect return to lab (can record condition: Working, Needs Checking, Not Working). `CONSUMABLE` items (solder wire, resistors) decrement balance permanently upon issue. | Matches standard university lab operational realities. |
| **Project & Team Support** | Items can be issued to an Individual Student or an authorized Project/Team. For team issues, the collecting student is recorded. | Ensures clear physical accountability while enabling collaborative capstone/hackathon teams. |
| **Kits / Packages** | Reusable templates (e.g. "Robotics Starter Kit"). When requested, kit expands into normal individual item request lines. | Preserves transparent stock deduction per constituent part without creating artificial kit stock locks. |
| **Return Enforcement & Conditions** | Expected return date is optional. Condition is recorded at return (Working, Needs Checking, Not Working) with optional note. No automated penalty or fine workflow in V1. | Friendly lab policy focused on inventory accuracy rather than punitive measures. |
| **Low-Stock Visibility** | Configurable minimum threshold on bulk items. Flags items on Admin dashboard when `available_quantity <= threshold`. | Simple, effective lab visibility without external SMS/mail dependencies. |
