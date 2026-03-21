# Skill: Redux Toolkit Patterns
**Smart-Fleet IoT | TanQHoang © 2026**

Use this skill when creating or modifying Redux slices, thunks, or selectors.

---

## Slice Template

```js
import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import axiosClient from '@/api/axiosClient';

// ─── Async Thunks ────────────────────────────────────────────────────────────

export const fetchExample = createAsyncThunk(
  'example/fetch',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await axiosClient.get('/example', { params });
      return data.data; // unwrap envelope
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || { message: 'Unknown error' });
    }
  }
);

// ─── Slice ───────────────────────────────────────────────────────────────────

const initialState = {
  items: [],
  selected: null,
  loading: false,
  error: null,
};

const exampleSlice = createSlice({
  name: 'example',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    setSelected: (state, action) => { state.selected = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchExample.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchExample.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchExample.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, setSelected } = exampleSlice.actions;
export default exampleSlice.reducer;

// ─── Selectors (MUST be memoized with createSelector) ────────────────────────

const selectExampleState = (state) => state.example;

export const selectAllItems = createSelector(
  selectExampleState,
  (example) => example.items
);

export const selectIsLoading = createSelector(
  selectExampleState,
  (example) => example.loading
);

export const selectError = createSelector(
  selectExampleState,
  (example) => example.error
);
```

---

## Rules

1. **Never** fetch data outside of `createAsyncThunk`. No `useEffect` + `axios.get()` directly in components.
2. **Always** memoize selectors with `createSelector`. Never access state fields directly in `useSelector` without a selector.
3. **Always** unwrap the API envelope in the thunk (`data.data`) — components should never see the `{ success, meta }` wrapper.
4. **Always** handle all three states: `pending`, `fulfilled`, `rejected`.
5. The `rejectWithValue` pattern ensures rejected thunks land in `action.payload`, not `action.error`.

---

## Store Shape Reference

```
state = {
  user: {
    profile: { id, email, name },
    isAuthenticated: boolean,
    loading: boolean,
    error: null | { code, message }
  },
  fleet: {
    vehicles: Vehicle[],
    selectedVehicleId: string | null,
    statusByVehicleId: { [id]: MaintenanceStatus },
    loading: boolean,
    error: null | { code, message }
  },
  weather: {
    current: { humidity, temp, condition, city },
    forecast: ForecastDay[],
    humidityMultiplier: number,    // computed from current.humidity
    loading: boolean,
    error: null | { code, message }
  },
  alert: {
    queue: Alert[],
    unreadCount: number,
    fcmToken: string | null,
    loading: boolean,
    error: null | { code, message }
  }
}
```

---

## useSelector Usage Pattern

```js
// CORRECT — memoized selector
import { selectAllVehicles } from '@/redux/fleetSlice';
const vehicles = useSelector(selectAllVehicles);

// WRONG — inline accessor, creates new reference on every render
const vehicles = useSelector((state) => state.fleet.vehicles);
```

---

## Dispatch Pattern in Components

```js
import { useDispatch } from 'react-redux';
import { fetchFleet } from '@/redux/fleetSlice';

const dispatch = useDispatch();

useEffect(() => {
  dispatch(fetchFleet());
}, [dispatch]);
```

Do not call `dispatch` with raw action creators that bypass the thunk pattern for async operations.
