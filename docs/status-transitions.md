# Status Transitions & Finite State Automata

## 1. User Status
```text
ACTIVE <---> INACTIVE
```
- Inactive users are forbidden from logging in or receiving new issues.
- Historical records reference the user ID without deletion.

## 2. Request Lifecycle Status
```text
          [Student submits]
                 |
                 v
              PENDING
             /   |   \
            /    |    \
 [Admin approves]|     \[Admin rejects]
          v      |      v
      APPROVED   |   REJECTED
          ^      v
           PARTIALLY_APPROVED
                 |
                 | [Student cancels before issue]
                 v
             CANCELLED
```
*Note: A request cannot transition to CANCELLED once any item on it has been issued.*

## 3. Request Fulfilment Status (Computed)
```text
NOT_ISSUED ----> PARTIALLY_ISSUED ----> FULFILLED
```
- `NOT_ISSUED`: No approved items have been handed over.
- `PARTIALLY_ISSUED`: Some lines or subset of quantities have been issued.
- `FULFILLED`: All approved quantities have been physically issued.

## 4. Serialized Unit Status
```text
             +-----------------------+
             |                       |
             v                       |
+-------------------+        +-------------------+
|     AVAILABLE     |------->|     ALLOCATED     |
+-------------------+        +-------------------+
      |        ^                       |
      |        |                       | [Returned as damaged/defective]
      v        |                       v
+-------------------+        +-------------------+
|    UNAVAILABLE    |<-------|   (From Return)   |
+-------------------+        +-------------------+
      |
      v [Permanently decommissioned]
+-------------------+
|      RETIRED      |
+-------------------+
```
- `AVAILABLE`: In the lab storage, ready for check-out.
- `ALLOCATED`: Physically issued to a student or project team.
- `UNAVAILABLE`: Under maintenance, checking, or reported damaged.
- `RETIRED`: Decommissioned or scrapped permanently.
