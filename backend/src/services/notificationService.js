// Smart-Fleet IoT — FCM Notification Service
// TanQHoang © 2026

const admin = require('firebase-admin');
const userModel = require('../models/userModel');
const logger = require('../utils/logger');

// Initialize Firebase Admin SDK exactly once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const ALERT_COPY = {
  CRITICAL: {
    title: '⚠️ Critical Maintenance Alert',
    body: (vehicle, component) =>
      `${vehicle.plate_number || vehicle.model} — ${component.replace('_', ' ')} is critically overdue. Service now.`,
  },
  OVERDUE: {
    title: '🚨 Maintenance Overdue',
    body: (vehicle, component) =>
      `${vehicle.plate_number || vehicle.model} — ${component.replace('_', ' ')} has exceeded its service interval.`,
  },
};

const notificationService = {
  async sendAlert(fcmToken, vehicle, component, status) {
    if (!fcmToken) return;

    const copy = ALERT_COPY[status];
    if (!copy) return;

    const message = {
      token: fcmToken,
      notification: {
        title: copy.title,
        body: copy.body(vehicle, component),
      },
      data: {
        vehicleId: vehicle.id,
        component,
        status,
        timestamp: new Date().toISOString(),
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    };

    try {
      const response = await admin.messaging().send(message);
      logger.info(`FCM sent [${status}] for vehicle ${vehicle.id}, component ${component}. messageId: ${response}`);
    } catch (err) {
      logger.error(`FCM send error for vehicle ${vehicle.id}: ${err.message}`);

      // Auto-cleanup invalid tokens
      if (err.code === 'messaging/registration-token-not-registered') {
        logger.warn(`Clearing invalid FCM token for vehicle owner ${vehicle.owner_id}`);
        await userModel.clearFcmToken(vehicle.owner_id).catch(() => {});
      }
    }
  },
};

module.exports = notificationService;
