# Domain Glossary & Canonical Concepts

## 1. Inventory & Storage
- **Item**: A catalog definition (e.g., *Arduino Uno Rev3*, *Raspberry Pi 4 4GB*, *SG90 Micro Servo*, *Lead-Free Solder Wire 0.8mm*). Holds metadata, category, nature, and tracking mode.
- **Nature**:
  - `RETURNABLE`: Expected to be returned to the lab after use (boards, tools, sensors, motors).
  - `CONSUMABLE`: Depleted or kept in projects, never returned (wires, solder, resistors, zip-ties).
- **Tracking Mode**:
  - `SERIALIZED`: Tracked on a per-physical-unit basis with a unique barcode/asset ID (e.g., `ARD-001`, `RPI-012`).
  - `BULK`: Tracked as aggregate numeric quantities at locations.
- **Inventory Unit**: An exact, unique physical instance of a `SERIALIZED` item. Has its own lifecycle status (`AVAILABLE`, `ALLOCATED`, `UNAVAILABLE`, `RETIRED`).
- **Location**: Hierarchical lab storage address:
  - `Lab` (e.g., *5th Floor Deep-Tech Centre*)
  - `Room` (e.g., *Embedded Systems Lab*, *Robotics Lab Room 502*)
  - `Cabinet / Rack` (e.g., *Cabinet A*, *Rack 3*)
  - `Shelf / Drawer` (e.g., *Drawer 2*, *Shelf B*)

## 2. Demand & Allocation
- **Request**: A formal application by a student to check out components.
  - Can be on behalf of **Personal** exploration or a registered **Project / Team**.
- **Request Line**: Specific item and quantity requested.
- **Decision**: Administrative review action on a request (`APPROVED`, `PARTIALLY_APPROVED`, `REJECTED`, or `CANCELLED`).
- **Issue (Handover)**: The physical action of handing over equipment. This is the **only point** where stock decreases or units become `ALLOCATED`.
- **Return**: Physical check-in of a returnable item back into lab custody.
- **Allocation**: The active holding of items/units currently in a student or team's possession.

## 3. Bundling & History
- **Kit / Package**: A predefined bundle template (e.g., *Autonomous Mobile Robot Kit* comprising 1 Arduino, 1 L298N motor driver, 2 TT gear motors, 2 wheels, 1 HC-SR04 ultrasonic sensor, jumper cables). Expands into individual request lines upon checkout.
- **Stock Movement**: Immutable ledger record tracing every change in inventory (RECEIPT, ISSUE, RETURN, ADJUSTMENT_IN, ADJUSTMENT_OUT, LOCATION_TRANSFER).
- **Audit Event**: Security and compliance log entry tracking actor, action, timestamp, and metadata.
