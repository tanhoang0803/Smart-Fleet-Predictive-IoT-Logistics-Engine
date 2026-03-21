// Smart-Fleet IoT — Redux Store
// TanQHoang © 2026

import { configureStore } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import fleetReducer from './fleetSlice';
import weatherReducer from './weatherSlice';
import alertReducer from './alertSlice';

const store = configureStore({
  reducer: {
    user: userReducer,
    fleet: fleetReducer,
    weather: weatherReducer,
    alert: alertReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export default store;
