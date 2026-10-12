import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Deep-Tech Innovation Centre — Lab Inventory Seed
// 7 categories | 35+ authentic components | 4 rooms | 6 kits | 3 projects
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding Deep-Tech Lab inventory data...');

  const passwordHash = await argon2.hash('Password@123');

  // ---------------------------------------------------------------- Users ----
  const admin = await prisma.user.upsert({
    where: { collegeId: 'ADMIN001' },
    update: {},
    create: {
      collegeId: 'ADMIN001',
      name: 'Dr. R. K. Verma (Faculty In-Charge)',
      email: 'admin.lab@college.edu',
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash,
      mustChangePassword: false,
    },
  });

  const studentSeed = [
    { collegeId: '2024BCSE042', name: 'Ayush Sharma', email: 'ayush.2024@college.edu' },
    { collegeId: '2024BCSE017', name: 'Sara Khan', email: 'sara.2024@college.edu' },
    { collegeId: '2024BEEE088', name: 'Rohan Mehta', email: 'rohan.2024@college.edu' },
    { collegeId: '2024BCSE103', name: 'Priya Nair', email: 'priya.2024@college.edu' },
    { collegeId: '2023BMEC056', name: 'Kabir Singh', email: 'kabir.2023@college.edu' },
  ];

  const students = [];
  for (const s of studentSeed) {
    students.push(
      await prisma.user.upsert({
        where: { collegeId: s.collegeId },
        update: {},
        create: { ...s, role: 'STUDENT', status: 'ACTIVE', passwordHash, mustChangePassword: false },
      }),
    );
  }
  const [ayush, sara, rohan, priya, kabir] = students;

  // ------------------------------------------------------------ Locations ----
  let lab = await prisma.location.findFirst({
    where: { name: '5th Floor Deep-Tech Innovation Centre', parentId: null },
  });
  if (!lab) {
    lab = await prisma.location.create({
      data: { name: '5th Floor Deep-Tech Innovation Centre', type: 'LAB' },
    });
  }

  const roomDefs = [
    { name: 'Robotics & Automation Lab (Room 501)', code: 'R501' },
    { name: 'Embedded Systems Lab (Room 502)', code: 'R502' },
    { name: 'IoT & Sensors Lab (Room 503)', code: 'R503' },
    { name: 'Fabrication & Prototyping Room (Room 504)', code: 'R504' },
  ];
  const rooms: Record<string, string> = {};
  for (const r of roomDefs) {
    const created = await prisma.location.upsert({
      where: { name_parentId: { name: r.name, parentId: lab.id } },
      update: {},
      create: { name: r.name, type: 'ROOM', parentId: lab.id },
    });
    rooms[r.code] = created.id;
  }

  async function cabinet(name: string, roomCode: string) {
    return prisma.location.upsert({
      where: { name_parentId: { name, parentId: rooms[roomCode] } },
      update: {},
      create: { name, type: 'CABINET', parentId: rooms[roomCode] },
    });
  }
  async function drawer(name: string, parentId: string) {
    return prisma.location.upsert({
      where: { name_parentId: { name, parentId } },
      update: {},
      create: { name, type: 'DRAWER', parentId },
    });
  }

  const cabA = await cabinet('Cabinet A — Microcontrollers', 'R501');
  const cabB = await cabinet('Cabinet B — Actuators & Motors', 'R501');
  const cabC = await cabinet('Cabinet C — Sensors & Perception', 'R503');
  const cabD = await cabinet('Cabinet D — Instruments & Tools', 'R502');
  const cabE = await cabinet('Cabinet E — Power & Energy', 'R502');
  const cabF = await cabinet('Cabinet F — Consumables Store', 'R504');
  const cabG = await cabinet('Cabinet G — SBCs & Edge AI', 'R501');

  const loc = {
    drawerArd: await drawer('Drawer 1 — Arduino Boards', cabA.id),
    drawerEsp: await drawer('Drawer 2 — ESP & Wireless', cabA.id),
    drawerStm: await drawer('Drawer 3 — STM32 & Teensy', cabA.id),
    shelfSbc: await drawer('Shelf 1 — Single Board Computers', cabG.id),
    shelfEdge: await drawer('Shelf 2 — Edge AI Accelerators', cabG.id),
    drawerDrivers: await drawer('Drawer 1 — Motor Drivers', cabB.id),
    drawerMotors: await drawer('Drawer 2 — DC & Stepper Motors', cabB.id),
    drawerServos: await drawer('Drawer 3 — Servos', cabB.id),
    drawerLidar: await drawer('Drawer 1 — LiDAR & Depth Cameras', cabC.id),
    drawerSensors: await drawer('Drawer 2 — Sensors & IMUs', cabC.id),
    shelfScopes: await drawer('Shelf 1 — Test Instruments', cabD.id),
    drawerMeters: await drawer('Drawer 1 — Multimeters & Tools', cabD.id),
    drawerPower: await drawer('Drawer 1 — Batteries & Chargers', cabE.id),
    shelfConv: await drawer('Shelf 1 — Converters & Regulators', cabE.id),
    binSolder: await drawer('Bin 1 — Solder & Wire', cabF.id),
    binFasteners: await drawer('Bin 2 — Fasteners & Standoffs', cabF.id),
    binProto: await drawer('Bin 3 — Breadboards & Jumpers', cabF.id),
    binFilament: await drawer('Bin 4 — 3D Printer Filament', cabF.id),
  };

  // ----------------------------------------------------------- Categories ----
  const catDefs = [
    { key: 'dev', name: 'Microcontrollers & Dev Boards', description: 'Arduino, ESP32, STM32, Teensy and development boards' },
    { key: 'sbc', name: 'Single Board Computers & Edge AI', description: 'Raspberry Pi, NVIDIA Jetson, Coral accelerators' },
    { key: 'motors', name: 'Motors, Actuators & Drivers', description: 'DC motors, servos, steppers and driver modules' },
    { key: 'sensors', name: 'Sensors & Perception', description: 'LiDAR, depth cameras, IMUs, ultrasonic and environmental sensors' },
    { key: 'power', name: 'Power & Energy', description: 'Batteries, chargers, converters and regulators' },
    { key: 'consumables', name: 'Consumables & Hardware', description: 'Solder, wire, fasteners, breadboards and filament' },
    { key: 'instruments', name: 'Lab Instruments & Tools', description: 'Oscilloscopes, multimeters, soldering stations and bench supplies' },
  ];
  const cat: Record<string, string> = {};
  for (const c of catDefs) {
    const created = await prisma.category.upsert({
      where: { name: c.name },
      update: { description: c.description },
      create: { name: c.name, description: c.description },
    });
    cat[c.key] = created.id;
  }

  // ---------------------------------------------------------------- Items ----
  type ItemDef = {
    id: string;
    name: string;
    model: string;
    description: string;
    cat: string;
    nature: 'RETURNABLE' | 'CONSUMABLE';
    tracking: 'SERIALIZED' | 'BULK';
    uom: string;
    low?: number;
    locId: string;
    prefix?: string;
    count?: number;
    qty?: number;
    conditions?: (string | null)[];
  };

  const items: ItemDef[] = [
    { id: 'item-arduino-uno', name: 'Arduino Uno R3', model: 'A000066 DIP Edition', description: 'ATmega328P 16MHz microcontroller board with USB-B interface and 14 digital I/O pins.', cat: 'dev', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.drawerArd.id, prefix: 'ARD', count: 6, conditions: ['Brand new in anti-static bag', null, 'Working', null, 'Slight scratch on PCB, functional', null] },
    { id: 'item-arduino-mega', name: 'Arduino Mega 2560 Rev3', model: 'A000067', description: 'ATmega2560 board with 54 digital I/O pins and 16 analog inputs for complex robotics builds.', cat: 'dev', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.drawerArd.id, prefix: 'MEGA', count: 3, conditions: [null, 'Working', null] },
    { id: 'item-esp32-s3', name: 'ESP32-S3 DevKitC-1', model: 'N16R8 WiFi + BLE', description: 'Dual-core Xtensa LX7 with 16MB flash, 8MB PSRAM, onboard Wi-Fi and Bluetooth 5 LE.', cat: 'dev', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.drawerEsp.id, prefix: 'ESP', count: 8, conditions: [null, null, 'Antenna slightly bent', null, null, 'Working', null, null] },
    { id: 'item-rpi-pico-w', name: 'Raspberry Pi Pico W', model: 'RP2040 + CYW43439', description: 'Dual-core ARM Cortex-M0+ microcontroller with wireless networking, 26 GPIO pins.', cat: 'dev', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.drawerEsp.id, prefix: 'PICO', count: 5, conditions: [null, null, null, 'Working', null] },
    { id: 'item-stm32-nucleo', name: 'STM32 Nucleo-F446RE', model: 'ARM Cortex-M4 180MHz', description: 'High-performance STM32 development board with Arduino-compatible headers and ST-LINK/V2-1.', cat: 'dev', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.drawerStm.id, prefix: 'STM', count: 4, conditions: [null, 'Working', null, null] },
    { id: 'item-teensy41', name: 'Teensy 4.1', model: 'i.MX RT1062 600MHz', description: '600MHz ARM Cortex-M7 with 55 GPIO pins, Ethernet PHY and microSD socket.', cat: 'dev', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.drawerStm.id, prefix: 'TNSY', count: 2, conditions: [null, 'Working'] },

    { id: 'item-rpi-4b', name: 'Raspberry Pi 4 Model B (4GB)', model: 'Quad Core Cortex-A72', description: 'Single-board computer with Gigabit Ethernet, dual 4K Micro-HDMI and USB 3.0.', cat: 'sbc', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.shelfSbc.id, prefix: 'RPI4', count: 4, conditions: ['With aluminium heat sink attached', null, 'Working', null] },
    { id: 'item-rpi5-8gb', name: 'Raspberry Pi 5 (8GB)', model: 'BCM2712 Cortex-A76', description: 'Latest-generation SBC with PCIe 2.0, dual 4Kp60 HDMI and real-time clock.', cat: 'sbc', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.shelfSbc.id, prefix: 'RPI5', count: 3, conditions: [null, 'New in box', null] },
    { id: 'item-jetson-orin', name: 'NVIDIA Jetson Orin Nano (8GB)', model: 'Developer Kit 900-13767', description: '40 TOPS edge AI computer for computer-vision and robotics inference workloads.', cat: 'sbc', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.shelfEdge.id, prefix: 'JET', count: 2, conditions: ['Includes 128GB NVMe SSD', null] },
    { id: 'item-coral-usb', name: 'Coral USB Accelerator', model: 'Edge TPU G950-01456', description: 'USB 3.0 Edge TPU co-processor providing 4 TOPS for on-device ML inference.', cat: 'sbc', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.shelfEdge.id, prefix: 'CORAL', count: 2, conditions: [null, 'Working'] },

    { id: 'item-l298n', name: 'L298N Dual H-Bridge Motor Driver', model: 'L298N Red Board', description: 'Dual H-bridge driver module handling 2A per channel at 5-35V.', cat: 'motors', nature: 'RETURNABLE', tracking: 'BULK', uom: 'pcs', low: 5, locId: loc.drawerDrivers.id, qty: 24 },
    { id: 'item-tb6600', name: 'TB6600 Stepper Motor Driver', model: '4A 9-42V Microstep', description: 'Industrial-grade stepper driver supporting up to 4A with 32x microstepping.', cat: 'motors', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.drawerDrivers.id, prefix: 'TB66', count: 4, conditions: [null, 'Working', null, null] },
    { id: 'item-nema17', name: 'NEMA 17 High-Torque Stepper Motor', model: '42-40 1.5A 0.4Nm', description: 'Bipolar stepper motor with 1.8 degree step angle, ideal for 3D printers and CNC axes.', cat: 'motors', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.drawerMotors.id, prefix: 'NEMA', count: 6, conditions: [null, null, 'Working', null, null, 'Working'] },
    { id: 'item-dc-geared-encoder', name: '12V DC Geared Motor with Encoder', model: 'JGB37-520 178RPM', description: 'Metal-gear DC motor with quadrature hall encoder for closed-loop rover drive.', cat: 'motors', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.drawerMotors.id, prefix: 'DCM', count: 4, conditions: [null, 'Working', null, null] },
    { id: 'item-mg996r', name: 'MG996R Metal Gear Servo', model: '11kg-cm Torque', description: 'High-torque metal-gear servo with 180 degree travel for robotic arms and steering.', cat: 'motors', nature: 'RETURNABLE', tracking: 'BULK', uom: 'pcs', low: 4, locId: loc.drawerServos.id, qty: 12 },
    { id: 'item-sg90', name: 'SG90 Micro Servo', model: '9g 1.8kg-cm', description: 'Lightweight micro servo for small pan-tilt mechanisms and RC projects.', cat: 'motors', nature: 'RETURNABLE', tracking: 'BULK', uom: 'pcs', low: 6, locId: loc.drawerServos.id, qty: 18 },

    { id: 'item-rplidar-a1', name: 'RPLiDAR A1M8 360 Laser Scanner', model: 'Slamtec A1M8', description: '2D 360-degree laser range scanner with 12m radius and 8kHz sampling rate.', cat: 'sensors', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.drawerLidar.id, prefix: 'LIDAR', count: 2, conditions: ['Calibration verified', 'Working'] },
    { id: 'item-realsense-d435i', name: 'Intel RealSense D435i Depth Camera', model: 'Depth + RGB + IMU', description: 'Stereo depth camera with integrated IMU and global shutter for SLAM research.', cat: 'sensors', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.drawerLidar.id, prefix: 'RS', count: 2, conditions: [null, 'Includes USB-C cable'] },
    { id: 'item-hc-sr04', name: 'HC-SR04 Ultrasonic Distance Sensor', model: '2cm-400cm Range', description: 'Classic ultrasonic ranging module for obstacle-avoidance and level sensing.', cat: 'sensors', nature: 'RETURNABLE', tracking: 'BULK', uom: 'pcs', low: 8, locId: loc.drawerSensors.id, qty: 26 },
    { id: 'item-mpu6050', name: 'MPU-6050 6-Axis Gyro Accelerometer', model: 'InvenSense MPU-6050', description: 'Combined 3-axis gyroscope and accelerometer with I2C interface and DMP.', cat: 'sensors', nature: 'RETURNABLE', tracking: 'BULK', uom: 'pcs', low: 6, locId: loc.drawerSensors.id, qty: 20 },
    { id: 'item-bme280', name: 'BME280 Temp Humidity Pressure Sensor', model: 'Bosch BME280 3.3V', description: 'Precision environmental sensor providing temperature, humidity and barometric pressure.', cat: 'sensors', nature: 'RETURNABLE', tracking: 'BULK', uom: 'pcs', low: 5, locId: loc.drawerSensors.id, qty: 16 },
    { id: 'item-vl53l0x', name: 'VL53L0X Time-of-Flight LiDAR', model: 'ST ToF 2m Range', description: 'Laser-ranging ToF distance sensor with millimetre accuracy over I2C.', cat: 'sensors', nature: 'RETURNABLE', tracking: 'BULK', uom: 'pcs', low: 5, locId: loc.drawerSensors.id, qty: 14 },

    { id: 'item-lipo-3s', name: '3S 11.1V 2200mAh LiPo Battery Pack', model: 'Turnigy 25C XT60', description: 'Three-cell lithium polymer pack with XT60 connector for high-current robotics.', cat: 'power', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.drawerPower.id, prefix: 'LIPO', count: 5, conditions: [null, 'Storage charge', null, null, 'Working'] },
    { id: 'item-18650', name: '18650 3.7V 2600mAh Rechargeable Cell', model: 'Samsung INR18650-26J', description: 'High-drain cylindrical lithium-ion cell for battery pack assembly.', cat: 'power', nature: 'RETURNABLE', tracking: 'BULK', uom: 'cells', low: 12, locId: loc.drawerPower.id, qty: 40 },
    { id: 'item-lipo-charger', name: 'LiPo Balance Charger B6AC', model: 'IMAX B6AC 80W', description: 'AC/DC multi-chemistry balance charger supporting LiPo, Li-Ion, NiMH and Pb.', cat: 'power', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.drawerPower.id, prefix: 'CHG', count: 2, conditions: [null, 'Working'] },
    { id: 'item-lm2596', name: 'LM2596 DC-DC Buck Converter', model: '3A Adjustable Step-Down', description: 'Adjustable step-down module regulating input 4.5-35V to an output of 1.25-30V.', cat: 'power', nature: 'RETURNABLE', tracking: 'BULK', uom: 'pcs', low: 8, locId: loc.shelfConv.id, qty: 30 },

    { id: 'item-solder-wire', name: 'Lead-Free Rosin Core Solder Wire 0.8mm', model: 'Sn99.3 Cu0.7 50g Spool', description: 'No-clean lead-free solder wire for clean prototyping joints.', cat: 'consumables', nature: 'CONSUMABLE', tracking: 'BULK', uom: 'spool', low: 3, locId: loc.binSolder.id, qty: 15 },
    { id: 'item-jumper-mf', name: '40-pin Male-to-Female Jumper Ribbon', model: '20cm Dupont', description: 'Colour-coded ribbon jumper cables for breadboard and header connections.', cat: 'consumables', nature: 'CONSUMABLE', tracking: 'BULK', uom: 'pcs', low: 12, locId: loc.binProto.id, qty: 48 },
    { id: 'item-breadboard', name: 'MB-102 830-Point Breadboard', model: '830 Tie Points', description: 'Solderless prototyping breadboard with self-adhesive backing and power rails.', cat: 'consumables', nature: 'CONSUMABLE', tracking: 'BULK', uom: 'pcs', low: 8, locId: loc.binProto.id, qty: 22 },
    { id: 'item-standoff-kit', name: 'M3 Hex Brass Standoff Kit', model: '120 pcs Assorted', description: 'Assorted M3 brass spacers, screws and nuts for mounting PCBs and enclosures.', cat: 'consumables', nature: 'CONSUMABLE', tracking: 'BULK', uom: 'kit', low: 4, locId: loc.binFasteners.id, qty: 9 },
    { id: 'item-heatshrink', name: 'Heat Shrink Tubing Assortment', model: '2:1 Ratio 328 pcs', description: 'Multi-size polyolefin heat-shrink tubing for insulation and strain relief.', cat: 'consumables', nature: 'CONSUMABLE', tracking: 'BULK', uom: 'box', low: 3, locId: loc.binFasteners.id, qty: 7 },
    { id: 'item-pla-filament', name: 'PLA 3D Printer Filament 1.75mm', model: '1kg Spool - Black', description: 'Standard-polylactide filament for FDM printing of brackets, chassis and jigs.', cat: 'consumables', nature: 'CONSUMABLE', tracking: 'BULK', uom: 'spool', low: 3, locId: loc.binFilament.id, qty: 8 },

    { id: 'item-rigol-scope', name: 'Rigol DS1054Z Digital Oscilloscope', model: '50MHz 4-Channel', description: 'Four-channel oscilloscope with 1GSa/s sampling and 24Mpts memory depth.', cat: 'instruments', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.shelfScopes.id, prefix: 'SCOPE', count: 2, conditions: ['Calibrated 2026-01', 'Working'] },
    { id: 'item-unite-multimeter', name: 'UNI-T UT61E+ True RMS Multimeter', model: 'True RMS 22000 Count', description: 'High-accuracy true-RMS bench multimeter with data logging over USB.', cat: 'instruments', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.drawerMeters.id, prefix: 'DMM', count: 3, conditions: [null, 'Working', null] },
    { id: 'item-ts100', name: 'TS100 Smart Mini Soldering Iron', model: '65W OLED Portable', description: 'Temperature-controlled portable soldering iron with OLED display and fast heat-up.', cat: 'instruments', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.drawerMeters.id, prefix: 'TS', count: 2, conditions: [null, 'Includes spare tip'] },
    { id: 'item-bench-psu', name: 'Variable DC Bench Power Supply 30V 5A', model: 'KORAD KA3005D', description: 'Programmable linear bench supply with current limiting and memory presets.', cat: 'instruments', nature: 'RETURNABLE', tracking: 'SERIALIZED', uom: 'pcs', locId: loc.shelfScopes.id, prefix: 'PSU', count: 2, conditions: [null, 'Working'] },
  ];

  const itemIds: Record<string, string> = {};

  for (const def of items) {
    const created = await prisma.item.upsert({
      where: { id: def.id },
      update: {
        name: def.name,
        model: def.model,
        description: def.description,
        categoryId: cat[def.cat],
        nature: def.nature,
        trackingMode: def.tracking,
        unitOfMeasure: def.uom,
        lowStockThreshold: def.low ?? null,
        defaultLocationId: def.locId,
      },
      create: {
        id: def.id,
        name: def.name,
        model: def.model,
        description: def.description,
        categoryId: cat[def.cat],
        nature: def.nature,
        trackingMode: def.tracking,
        unitOfMeasure: def.uom,
        lowStockThreshold: def.low ?? null,
        defaultLocationId: def.locId,
      },
    });
    itemIds[def.id] = created.id;

    if (def.tracking === 'SERIALIZED' && def.prefix && def.count) {
      for (let i = 1; i <= def.count; i += 1) {
        const assetCode = `${def.prefix}-${String(i).padStart(3, '0')}`;
        await prisma.inventoryUnit.upsert({
          where: { assetCode },
          update: { itemId: created.id, homeLocationId: def.locId, currentLocationId: def.locId },
          create: {
            itemId: created.id,
            assetCode,
            serialNumber: `SN-${def.prefix}-${String(i).padStart(4, '0')}`,
            homeLocationId: def.locId,
            currentLocationId: def.locId,
            status: 'AVAILABLE',
            conditionNote: def.conditions?.[i - 1] ?? null,
          },
        });
      }
    } else if (def.tracking === 'BULK' && def.qty != null) {
      await prisma.stockBalance.upsert({
        where: { itemId_locationId: { itemId: created.id, locationId: def.locId } },
        update: { availableQuantity: def.qty, allocatedQuantity: 0 },
        create: {
          itemId: created.id,
          locationId: def.locId,
          availableQuantity: def.qty,
          allocatedQuantity: 0,
        },
      });
    }
  }

  // -------------------------------------------------------------- Projects ----
  const projectDefs = [
    {
      name: 'Autonomous Rover Team (DeepTech-2026)',
      description: 'LiDAR-guided autonomous ground vehicle for indoor mapping and navigation.',
      members: [ayush, sara, kabir],
    },
    {
      name: 'Smart Agriculture IoT Node',
      description: 'LoRa-connected soil, humidity and climate monitoring node for the campus farm.',
      members: [rohan, priya],
    },
    {
      name: 'Vision-Guided Robotic Arm',
      description: 'Six-axis arm with depth-camera pick-and-place for a warehouse simulation.',
      members: [kabir, ayush],
    },
  ];

  const projects: Record<string, string> = {};
  for (const p of projectDefs) {
    const created = await prisma.project.upsert({
      where: { name: p.name },
      update: { description: p.description },
      create: {
        name: p.name,
        description: p.description,
        members: { create: p.members.map((u, idx) => ({ userId: u.id, role: idx === 0 ? 'LEADER' : 'MEMBER' })) },
      },
    });
    projects[p.name] = created.id;
  }

  // ------------------------------------------------------------------ Kits ----
  const kitDefs = [
    {
      name: 'Robotics Core Starter Kit',
      description: 'Everything needed for a first differential-drive robot: controller, driver and motors.',
      items: [
        { itemId: 'item-arduino-uno', quantity: 1 },
        { itemId: 'item-l298n', quantity: 1 },
        { itemId: 'item-dc-geared-encoder', quantity: 2 },
        { itemId: 'item-hc-sr04', quantity: 1 },
        { itemId: 'item-jumper-mf', quantity: 2 },
      ],
    },
    {
      name: 'IoT Sensor Node Kit',
      description: 'Wireless sensor stack for environmental monitoring and telemetry projects.',
      items: [
        { itemId: 'item-esp32-s3', quantity: 1 },
        { itemId: 'item-bme280', quantity: 1 },
        { itemId: 'item-mpu6050', quantity: 1 },
        { itemId: 'item-jumper-mf', quantity: 1 },
      ],
    },
    {
      name: 'Edge AI Vision Kit',
      description: 'Accelerated vision platform for object detection and depth-sensing research.',
      items: [
        { itemId: 'item-jetson-orin', quantity: 1 },
        { itemId: 'item-realsense-d435i', quantity: 1 },
        { itemId: 'item-coral-usb', quantity: 1 },
      ],
    },
    {
      name: 'LiDAR Mapping Payload',
      description: 'Scanning and inertial payload for SLAM and autonomous mapping experiments.',
      items: [
        { itemId: 'item-rplidar-a1', quantity: 1 },
        { itemId: 'item-rpi-4b', quantity: 1 },
        { itemId: 'item-mpu6050', quantity: 1 },
      ],
    },
    {
      name: 'Prototyping & Soldering Bench Kit',
      description: 'Bench essentials for assembly, testing and wiring of new boards.',
      items: [
        { itemId: 'item-ts100', quantity: 1 },
        { itemId: 'item-solder-wire', quantity: 1 },
        { itemId: 'item-unite-multimeter', quantity: 1 },
        { itemId: 'item-breadboard', quantity: 1 },
        { itemId: 'item-jumper-mf', quantity: 1 },
      ],
    },
    {
      name: 'Mechatronics Motor Control Kit',
      description: 'Stepper-drive bundle for CNC, gantry and precision motion builds.',
      items: [
        { itemId: 'item-tb6600', quantity: 1 },
        { itemId: 'item-nema17', quantity: 2 },
        { itemId: 'item-stm32-nucleo', quantity: 1 },
      ],
    },
  ];

  for (const k of kitDefs) {
    const existing = await prisma.kit.findUnique({ where: { name: k.name } });
    if (existing) {
      await prisma.kitItem.deleteMany({ where: { kitId: existing.id } });
      await prisma.kit.update({
        where: { id: existing.id },
        data: {
          description: k.description,
          items: { create: k.items.map((i) => ({ itemId: itemIds[i.itemId], quantity: i.quantity })) },
        },
      });
    } else {
      await prisma.kit.create({
        data: {
          name: k.name,
          description: k.description,
          items: { create: k.items.map((i) => ({ itemId: itemIds[i.itemId], quantity: i.quantity })) },
        },
      });
    }
  }

  // ------------------- Live demo workflow state (active loans + history) ------
  const existingIssue = await prisma.issue.findFirst();
  if (!existingIssue) {
    // 1) A previously approved + fully issued request whose loan is STILL OUT.
    const approvedRequest = await prisma.request.create({
      data: {
        requesterId: sara.id,
        targetType: 'PROJECT',
        projectId: projects['Autonomous Rover Team (DeepTech-2026)'],
        purpose: 'Motor drive electronics for the line-following chassis build.',
        expectedReturnDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        decisionStatus: 'APPROVED',
        decisionReason: 'Approved — chassis drive stack needed for the rover sprint.',
        decidedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        fulfilmentStatus: 'FULFILLED',
        lines: {
          create: [
            { itemId: itemIds['item-l298n'], requestedQty: 1, approvedQty: 1, issuedQty: 1 },
            { itemId: itemIds['item-nema17'], requestedQty: 2, approvedQty: 2, issuedQty: 2 },
            { itemId: itemIds['item-18650'], requestedQty: 4, approvedQty: 4, issuedQty: 4 },
          ],
        },
      },
    });

    const approvedLines = await prisma.requestLine.findMany({
      where: { requestId: approvedRequest.id },
      include: { item: true },
    });

    const l298nLine = approvedLines.find((l) => l.item.name.includes('L298N'))!;
    const nemaLine = approvedLines.find((l) => l.item.name.includes('NEMA 17'))!;
    const cellLine = approvedLines.find((l) => l.item.name.includes('18650'))!;

    const l298nUnits = await prisma.inventoryUnit.findMany({
      where: { itemId: l298nLine.itemId, status: 'AVAILABLE' },
      take: 1,
    });
    const nemaUnits = await prisma.inventoryUnit.findMany({
      where: { itemId: nemaLine.itemId, status: 'AVAILABLE' },
      take: 2,
    });
    const cellBalance = await prisma.stockBalance.findFirst({
      where: { itemId: cellLine.itemId },
    });

    const issue = await prisma.issue.create({
      data: {
        requestId: approvedRequest.id,
        studentId: sara.id,
        projectId: approvedRequest.projectId,
        issuedById: admin.id,
        expectedReturnDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        note: 'Handed over at the 5th floor counter after verifying asset tags.',
        createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        lines: {
          create: [
            {
              requestLineId: l298nLine.id,
              quantity: 1,
              units: { create: l298nUnits.map((u) => ({ unitId: u.id })) },
            },
            {
              requestLineId: nemaLine.id,
              quantity: 2,
              units: { create: nemaUnits.map((u) => ({ unitId: u.id })) },
            },
            { requestLineId: cellLine.id, quantity: 4 },
          ],
        },
      },
      include: { lines: true },
    });

    // Lock those serial units as ALLOCATED and pull the bulk cells out of stock.
    for (const unit of [...l298nUnits, ...nemaUnits]) {
      await prisma.inventoryUnit.update({
        where: { id: unit.id },
        data: { status: 'ALLOCATED', currentLocationId: null },
      });
      await prisma.stockMovement.create({
        data: {
          itemId: unit.itemId,
          unitId: unit.id,
          sourceLocationId: unit.homeLocationId,
          quantity: 1,
          type: 'ISSUE',
          actorId: admin.id,
          reason: 'Issued against approved chassis drive request',
          createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        },
      });
    }
    if (cellBalance) {
      await prisma.stockBalance.update({
        where: { id: cellBalance.id },
        data: { availableQuantity: { decrement: 4 }, allocatedQuantity: { increment: 4 } },
      });
      await prisma.stockMovement.create({
        data: {
          itemId: cellLine.itemId,
          sourceLocationId: cellBalance.locationId,
          quantity: 4,
          type: 'ISSUE',
          actorId: admin.id,
          reason: 'Issued against approved chassis drive request',
          createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        },
      });
    }

    // 2) An older request that was issued and then returned in Working condition,
    //    so the audit ledger already has RETURN history.
    const closedRequest = await prisma.request.create({
      data: {
        requesterId: rohan.id,
        targetType: 'PROJECT',
        projectId: projects['Smart Agriculture IoT Node'],
        purpose: 'Soil-moisture pilot node built during the design review week.',
        expectedReturnDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        decisionStatus: 'APPROVED',
        decisionReason: 'Approved for the week-long pilot deployment.',
        decidedAt: new Date(Date.now() - 34 * 24 * 60 * 60 * 1000),
        fulfilmentStatus: 'FULFILLED',
        lines: {
          create: [
            { itemId: itemIds['item-bme280'], requestedQty: 2, approvedQty: 2, issuedQty: 2 },
            { itemId: itemIds['item-esp32-s3'], requestedQty: 1, approvedQty: 1, issuedQty: 1 },
          ],
        },
      },
    });

    const closedLines = await prisma.requestLine.findMany({
      where: { requestId: closedRequest.id },
      include: { item: true },
    });
    const bmeLine = closedLines.find((l) => l.item.name.includes('BME280'))!;
    const espLine = closedLines.find((l) => l.item.name.includes('ESP32'))!;
    const espUnits = await prisma.inventoryUnit.findMany({
      where: { itemId: espLine.itemId, status: 'AVAILABLE' },
      take: 1,
    });
    const bmeBalance = await prisma.stockBalance.findFirst({
      where: { itemId: bmeLine.itemId },
    });

    const closedIssue = await prisma.issue.create({
      data: {
        requestId: closedRequest.id,
        studentId: rohan.id,
        projectId: closedRequest.projectId,
        issuedById: admin.id,
        expectedReturnDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        note: 'Issued for the pilot deployment.',
        createdAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        lines: {
          create: [
            { requestLineId: bmeLine.id, quantity: 2 },
            {
              requestLineId: espLine.id,
              quantity: 1,
              units: { create: espUnits.map((u) => ({ unitId: u.id })) },
            },
          ],
        },
      },
      include: { lines: true },
    });

    if (espUnits[0]) {
      await prisma.inventoryUnit.update({
        where: { id: espUnits[0].id },
        data: { status: 'ALLOCATED', currentLocationId: null },
      });
      await prisma.stockMovement.create({
        data: {
          itemId: espUnits[0].itemId,
          unitId: espUnits[0].id,
          sourceLocationId: espUnits[0].homeLocationId,
          quantity: 1,
          type: 'ISSUE',
          actorId: admin.id,
          reason: 'Issued against the pilot soil-moisture node request',
          createdAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        },
      });
    }
    if (bmeBalance) {
      await prisma.stockBalance.update({
        where: { id: bmeBalance.id },
        data: { availableQuantity: { decrement: 2 }, allocatedQuantity: { increment: 2 } },
      });
      await prisma.stockMovement.create({
        data: {
          itemId: bmeLine.itemId,
          sourceLocationId: bmeBalance.locationId,
          quantity: 2,
          type: 'ISSUE',
          actorId: admin.id,
          reason: 'Issued against the pilot soil-moisture node request',
          createdAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        },
      });
    }

    const bmeIssueLine = closedIssue.lines.find((l) => l.quantity === 2)!;
    const espIssueLine = closedIssue.lines.find((l) => l.quantity === 1)!;

    const returnRecord = await prisma.return.create({
      data: {
        issueId: closedIssue.id,
        processedById: admin.id,
        note: 'Pilot concluded — all items returned in working condition.',
        createdAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
        lines: {
          create: [
            { issueLineId: bmeIssueLine.id, quantity: 2, condition: 'WORKING' },
            {
              issueLineId: espIssueLine.id,
              quantity: 1,
              condition: 'WORKING',
              units: { create: espUnits.map((u) => ({ unitId: u.id })) },
            },
          ],
        },
      },
      include: { lines: true },
    });

    for (const line of returnRecord.lines) {
      await prisma.issueLine.update({
        where: { id: line.issueLineId },
        data: { returnedQty: line.quantity },
      });
    }

    if (espUnits[0]) {
      await prisma.inventoryUnit.update({
        where: { id: espUnits[0].id },
        data: { status: 'AVAILABLE', currentLocationId: espUnits[0].homeLocationId, conditionNote: null },
      });
      await prisma.stockMovement.create({
        data: {
          itemId: espUnits[0].itemId,
          unitId: espUnits[0].id,
          sourceLocationId: null,
          destLocationId: espUnits[0].homeLocationId,
          quantity: 1,
          type: 'RETURN',
          actorId: admin.id,
          reason: 'Returned in working condition after pilot deployment',
          createdAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
        },
      });
    }
    if (bmeBalance) {
      await prisma.stockBalance.update({
        where: { id: bmeBalance.id },
        data: { availableQuantity: { increment: 2 }, allocatedQuantity: { decrement: 2 } },
      });
      await prisma.stockMovement.create({
        data: {
          itemId: bmeLine.itemId,
          sourceLocationId: null,
          destLocationId: bmeBalance.locationId,
          quantity: 2,
          type: 'RETURN',
          actorId: admin.id,
          reason: 'Returned in working condition after pilot deployment',
          createdAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  const existingRequest = await prisma.request.findFirst({ where: { requesterId: ayush.id } });
  if (!existingRequest) {
    await prisma.request.create({
      data: {
        requesterId: ayush.id,
        targetType: 'PROJECT',
        projectId: projects['Autonomous Rover Team (DeepTech-2026)'],
        purpose: 'Chassis sensor stack for the indoor mapping field trial this semester.',
        expectedReturnDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        decisionStatus: 'PENDING',
        lines: {
          create: [
            { itemId: itemIds['item-rplidar-a1'], requestedQty: 1 },
            { itemId: itemIds['item-mpu6050'], requestedQty: 2 },
            { itemId: itemIds['item-18650'], requestedQty: 6 },
          ],
        },
      },
    });

    await prisma.request.create({
      data: {
        requesterId: rohan.id,
        targetType: 'PROJECT',
        projectId: projects['Smart Agriculture IoT Node'],
        purpose: 'Sensor head for the first field deployment of the agriculture node.',
        decisionStatus: 'PENDING',
        lines: {
          create: [
            { itemId: itemIds['item-esp32-s3'], requestedQty: 1 },
            { itemId: itemIds['item-bme280'], requestedQty: 2 },
            { itemId: itemIds['item-pla-filament'], requestedQty: 1 },
          ],
        },
      },
    });

    await prisma.request.create({
      data: {
        requesterId: priya.id,
        targetType: 'PERSONAL',
        purpose: 'Course mini-project demonstration on embedded motor control.',
        decisionStatus: 'PENDING',
        lines: {
          create: [
            { itemId: itemIds['item-arduino-uno'], requestedQty: 1 },
            { itemId: itemIds['item-sg90'], requestedQty: 2 },
          ],
        },
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    categories: await prisma.category.count(),
    items: await prisma.item.count(),
    units: await prisma.inventoryUnit.count(),
    locations: await prisma.location.count(),
    kits: await prisma.kit.count(),
    projects: await prisma.project.count(),
    requests: await prisma.request.count(),
  };

  console.log('Database seeded successfully.');
  console.log(`  Users: ${counts.users} | Categories: ${counts.categories} | Items: ${counts.items}`);
  console.log(`  Serialized units: ${counts.units} | Locations: ${counts.locations}`);
  console.log(`  Kits: ${counts.kits} | Projects: ${counts.projects} | Requests: ${counts.requests}`);
  console.log(`  Admin: ${admin.collegeId} | Password: Password@123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
