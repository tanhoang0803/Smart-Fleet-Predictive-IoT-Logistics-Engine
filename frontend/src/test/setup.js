// Smart-Fleet IoT — Vitest setup
// TanQHoang © 2026
import { vi } from 'vitest';

// Silence console.error in tests
vi.spyOn(console, 'error').mockImplementation(() => {});
