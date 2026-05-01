require('dotenv').config({ path: './.env' });

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const FoodItem = require('../models/FoodItem');
const DemandCenter = require('../models/DemandCenter');
const { estimateMealsFromQuantity } = require('../services/allocationService');
const { buildFreshnessSnapshot, normalizeSensorReading } = require('../services/freshnessService');

const DEMO_PASSWORD = 'demo1234';

function futureDate(hoursFromNow) {
    return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

async function upsertUser(user) {
    const existing = await User.findOne({ email: user.email });
    const hashedPassword = existing?.password || await bcrypt.hash(DEMO_PASSWORD, 10);

    return User.findOneAndUpdate(
        { email: user.email },
        {
            $set: {
                ...user,
                password: hashedPassword
            }
        },
        { upsert: true, new: true, runValidators: true }
    );
}

async function upsertDemandCenter(center) {
    return DemandCenter.findOneAndUpdate(
        { name: center.name },
        { $set: center },
        { upsert: true, new: true, runValidators: true }
    );
}

async function upsertFood(food) {
    const reading = food.sensorReading ? normalizeSensorReading(food.sensorReading) : null;
    const freshness = buildFreshnessSnapshot(reading || {}, {
        expiryDate: food.expiryDate,
        category: food.category
    });

    return FoodItem.findOneAndUpdate(
        { title: food.title, donor: food.donor },
        {
            $set: {
                ...food,
                location: food.pickupAddress,
                expiryTimestamp: food.expiryDate,
                estimatedMeals: estimateMealsFromQuantity(food.quantity),
                freshness,
                isAvailable: true,
                status: 'available',
                claimedBy: null
            },
            $setOnInsert: {
                sensorReadings: reading ? [{
                    temperatureC: reading.temperatureC,
                    humidityPct: reading.humidityPct,
                    gasLevel: reading.gasLevel,
                    gasIndex: reading.gasIndex,
                    observedAt: reading.observedAt,
                    receivedAt: new Date(),
                    source: 'seed'
                }] : []
            }
        },
        { upsert: true, new: true, runValidators: true }
    );
}

async function main() {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is missing. Paste your MongoDB Atlas connection string into eco-eats-backend/.env first.');
    }

    await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 10000)
    });

    const donor = await upsertUser({
        username: 'demo_donor',
        email: 'donor@ecoeats.demo',
        role: 'donor',
        organization: 'Demo Cafe',
        phone: '9999999999',
        address: 'MG Road, Bengaluru'
    });

    const receiver = await upsertUser({
        username: 'demo_receiver',
        email: 'receiver@ecoeats.demo',
        role: 'receiver',
        organization: 'Community Kitchen Demo',
        phone: '8888888888',
        address: 'Indiranagar, Bengaluru'
    });

    await Promise.all([
        upsertDemandCenter({
            name: 'Indiranagar Community Kitchen',
            address: 'Indiranagar, Bengaluru',
            coordinates: { lat: 12.9719, lng: 77.6412 },
            mealNeed: 120,
            capacityMeals: 180,
            urgency: 'critical',
            acceptedCategories: ['prepared-meals', 'produce', 'general'],
            operatingHours: '10 AM - 9 PM',
            contactPhone: '8888888888',
            notes: 'High evening meal demand.',
            active: true
        }),
        upsertDemandCenter({
            name: 'Koramangala Relief Center',
            address: 'Koramangala, Bengaluru',
            coordinates: { lat: 12.9352, lng: 77.6245 },
            mealNeed: 80,
            capacityMeals: 120,
            urgency: 'high',
            acceptedCategories: ['prepared-meals', 'bakery', 'packaged', 'general'],
            operatingHours: '9 AM - 8 PM',
            contactPhone: '7777777777',
            notes: 'Can accept packed cooked food.',
            active: true
        })
    ]);

    await Promise.all([
        upsertFood({
            title: 'Demo Fresh Rice Meals',
            description: 'Cooked rice and dal packed for immediate distribution.',
            pickupAddress: 'MG Road, Bengaluru',
            pickupCoordinates: { lat: 12.9756, lng: 77.6069 },
            geocodeProvider: 'seed',
            geocodedAt: new Date(),
            expiryDate: futureDate(8),
            quantity: '24 kg',
            category: 'prepared-meals',
            deviceId: 'eco-device-001',
            sensorReading: {
                temperatureC: 5,
                humidityPct: 62,
                gasLevel: 18,
                readingAt: new Date()
            },
            donor: donor._id
        }),
        upsertFood({
            title: 'Demo Bakery Surplus',
            description: 'Bread and buns from the morning batch.',
            pickupAddress: 'Church Street, Bengaluru',
            pickupCoordinates: { lat: 12.9752, lng: 77.6050 },
            geocodeProvider: 'seed',
            geocodedAt: new Date(),
            expiryDate: futureDate(16),
            quantity: '12 kg',
            category: 'bakery',
            deviceId: 'eco-device-002',
            sensorReading: {
                temperatureC: 24,
                humidityPct: 58,
                gasLevel: 22,
                readingAt: new Date()
            },
            donor: donor._id
        })
    ]);

    console.log('Demo data ready.');
    console.log('Donor login: donor@ecoeats.demo /', DEMO_PASSWORD);
    console.log('Receiver login: receiver@ecoeats.demo /', DEMO_PASSWORD);

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error('Demo seed failed:', err.message);
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    process.exit(1);
});
