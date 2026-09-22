import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
const prisma = new PrismaClient();
async function main() {
    console.log('Seeding initial Deep-Tech Lab inventory data...');
    // 1. Admin and Student Users
    const passwordHash = await argon2.hash('Password@123');
    const admin = await prisma.user.upsert({
        where: { collegeId: 'ADMIN001' },
        update: {},
        create: {
            collegeId: 'ADMIN001',
            name: 'Lab Admin (Faculty In-Charge)',
            email: 'admin.lab@college.edu',
            role: 'ADMIN',
            status: 'ACTIVE',
            passwordHash,
            mustChangePassword: false,
        },
    });
    const student = await prisma.user.upsert({
        where: { collegeId: '2024BCSE042' },
        update: {},
        create: {
            collegeId: '2024BCSE042',
            name: 'Ayush Sharma',
            email: 'ayush.2024@college.edu',
            role: 'STUDENT',
            status: 'ACTIVE',
            passwordHash,
            mustChangePassword: false,
        },
    });
    // 2. Hierarchical Storage Locations
    let lab5th = await prisma.location.findFirst({
        where: { name: '5th Floor Innovation Hub', parentId: null },
    });
    if (!lab5th) {
        lab5th = await prisma.location.create({
            data: {
                name: '5th Floor Innovation Hub',
                type: 'LAB',
            },
        });
    }
    const roboticsRoom = await prisma.location.upsert({
        where: { name_parentId: { name: 'Robotics & Automation Lab (Room 501)', parentId: lab5th.id } },
        update: {},
        create: {
            name: 'Robotics & Automation Lab (Room 501)',
            type: 'ROOM',
            parentId: lab5th.id,
        },
    });
    const cabinetA = await prisma.location.upsert({
        where: { name_parentId: { name: 'Cabinet A (Microcontrollers)', parentId: roboticsRoom.id } },
        update: {},
        create: {
            name: 'Cabinet A (Microcontrollers)',
            type: 'CABINET',
            parentId: roboticsRoom.id,
        },
    });
    const drawer1 = await prisma.location.upsert({
        where: { name_parentId: { name: 'Drawer 1 (Arduino Boards)', parentId: cabinetA.id } },
        update: {},
        create: {
            name: 'Drawer 1 (Arduino Boards)',
            type: 'DRAWER',
            parentId: cabinetA.id,
        },
    });
    const drawer2 = await prisma.location.upsert({
        where: { name_parentId: { name: 'Drawer 2 (Single Board Computers)', parentId: cabinetA.id } },
        update: {},
        create: {
            name: 'Drawer 2 (Single Board Computers)',
            type: 'DRAWER',
            parentId: cabinetA.id,
        },
    });
    const cabinetB = await prisma.location.upsert({
        where: { name_parentId: { name: 'Cabinet B (Actuators & Bulk)', parentId: roboticsRoom.id } },
        update: {},
        create: {
            name: 'Cabinet B (Actuators & Bulk)',
            type: 'CABINET',
            parentId: roboticsRoom.id,
        },
    });
    // 3. Item Categories
    const devBoardsCat = await prisma.category.upsert({
        where: { name: 'Microcontrollers & SBCs' },
        update: {},
        create: {
            name: 'Microcontrollers & SBCs',
            description: 'Arduino, ESP32, Raspberry Pi, STM32 development boards',
        },
    });
    const actuatorsCat = await prisma.category.upsert({
        where: { name: 'Motors & Actuators' },
        update: {},
        create: {
            name: 'Motors & Actuators',
            description: 'DC Motors, Servos, Steppers and Drivers',
        },
    });
    const consumablesCat = await prisma.category.upsert({
        where: { name: 'Consumables & Hardware' },
        update: {},
        create: {
            name: 'Consumables & Hardware',
            description: 'Wires, solder, resistors, fasteners, and breadboards',
        },
    });
    // 4. Items (Serialized Returnable vs Bulk Consumable)
    const arduino = await prisma.item.upsert({
        where: { id: 'item-arduino-uno' },
        update: {},
        create: {
            id: 'item-arduino-uno',
            name: 'Arduino Uno R3',
            model: 'A000066 DIP Edition',
            description: 'ATmega328P 16MHz microcontroller board with USB-B interface',
            categoryId: devBoardsCat.id,
            nature: 'RETURNABLE',
            trackingMode: 'SERIALIZED',
            unitOfMeasure: 'pcs',
            defaultLocationId: drawer1.id,
        },
    });
    const rpi4 = await prisma.item.upsert({
        where: { id: 'item-rpi-4b' },
        update: {},
        create: {
            id: 'item-rpi-4b',
            name: 'Raspberry Pi 4 Model B (4GB)',
            model: 'Quad Core Cortex-A72',
            description: 'Single-board computer with Gigabit Ethernet, 4K Micro-HDMI',
            categoryId: devBoardsCat.id,
            nature: 'RETURNABLE',
            trackingMode: 'SERIALIZED',
            unitOfMeasure: 'pcs',
            defaultLocationId: drawer2.id,
        },
    });
    const motorDriver = await prisma.item.upsert({
        where: { id: 'item-l298n' },
        update: {},
        create: {
            id: 'item-l298n',
            name: 'L298N Dual H-Bridge Motor Driver Module',
            model: 'L298N Red Board',
            description: 'High power dual motor driver module for robotics projects',
            categoryId: actuatorsCat.id,
            nature: 'RETURNABLE',
            trackingMode: 'BULK',
            unitOfMeasure: 'pcs',
            lowStockThreshold: 5,
            defaultLocationId: cabinetB.id,
        },
    });
    const solderWire = await prisma.item.upsert({
        where: { id: 'item-solder-wire' },
        update: {},
        create: {
            id: 'item-solder-wire',
            name: 'Lead-Free Rosin Core Solder Wire 0.8mm',
            model: 'Sn99.3 Cu0.7 50g spool',
            description: 'High grade soldering wire for prototyping lab use',
            categoryId: consumablesCat.id,
            nature: 'CONSUMABLE',
            trackingMode: 'BULK',
            unitOfMeasure: 'spool',
            lowStockThreshold: 3,
            defaultLocationId: cabinetB.id,
        },
    });
    // 5. Serialized Units for Arduino and Raspberry Pi
    await prisma.inventoryUnit.upsert({
        where: { assetCode: 'ARD-001' },
        update: {},
        create: {
            itemId: arduino.id,
            assetCode: 'ARD-001',
            serialNumber: 'SN-ARD-2024-001',
            homeLocationId: drawer1.id,
            currentLocationId: drawer1.id,
            status: 'AVAILABLE',
            conditionNote: 'Brand new in anti-static bag',
        },
    });
    await prisma.inventoryUnit.upsert({
        where: { assetCode: 'ARD-002' },
        update: {},
        create: {
            itemId: arduino.id,
            assetCode: 'ARD-002',
            serialNumber: 'SN-ARD-2024-002',
            homeLocationId: drawer1.id,
            currentLocationId: drawer1.id,
            status: 'AVAILABLE',
        },
    });
    await prisma.inventoryUnit.upsert({
        where: { assetCode: 'RPI-001' },
        update: {},
        create: {
            itemId: rpi4.id,
            assetCode: 'RPI-001',
            serialNumber: 'SN-RPI4-8842',
            homeLocationId: drawer2.id,
            currentLocationId: drawer2.id,
            status: 'AVAILABLE',
            conditionNote: 'With aluminum heat sink attached',
        },
    });
    // 6. Bulk Stock Balances
    await prisma.stockBalance.upsert({
        where: { itemId_locationId: { itemId: motorDriver.id, locationId: cabinetB.id } },
        update: { availableQuantity: 24 },
        create: {
            itemId: motorDriver.id,
            locationId: cabinetB.id,
            availableQuantity: 24,
            allocatedQuantity: 0,
        },
    });
    await prisma.stockBalance.upsert({
        where: { itemId_locationId: { itemId: solderWire.id, locationId: cabinetB.id } },
        update: { availableQuantity: 15 },
        create: {
            itemId: solderWire.id,
            locationId: cabinetB.id,
            availableQuantity: 15,
            allocatedQuantity: 0,
        },
    });
    // 7. Project & Member
    const project = await prisma.project.upsert({
        where: { name: 'Autonomous Rover Team (DeepTech-2026)' },
        update: {},
        create: {
            name: 'Autonomous Rover Team (DeepTech-2026)',
            description: 'Lidar-guided autonomous ground vehicle for indoor mapping',
            members: {
                create: {
                    userId: student.id,
                    role: 'LEADER',
                },
            },
        },
    });
    // 8. Pre-assembled Robotics Kit Template
    const kit = await prisma.kit.upsert({
        where: { name: 'Robotics Core Starter Kit' },
        update: {},
        create: {
            name: 'Robotics Core Starter Kit',
            description: 'Complete basic starter kit containing 1 Arduino Uno, 1 L298N driver, and 1 solder wire spool',
            items: {
                create: [
                    { itemId: arduino.id, quantity: 1 },
                    { itemId: motorDriver.id, quantity: 1 },
                    { itemId: solderWire.id, quantity: 1 },
                ],
            },
        },
    });
    console.log('Database seeded successfully!');
    console.log(`Admin user: ${admin.collegeId} | Student user: ${student.collegeId}`);
    console.log(`Kit: "${kit.name}" | Project: "${project.name}"`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map