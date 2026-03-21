// Smart-Fleet IoT — Maintenance Model
// TanQHoang © 2026

const { supabase } = require('../utils/supabaseClient');

const maintenanceModel = {
  // ─── Logs ─────────────────────────────────────────────────────────────────

  async findLogsByVehicle(vehicleId, { page = 1, limit = 20 } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('maintenance_logs')
      .select('*', { count: 'exact' })
      .eq('vehicle_id', vehicleId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { items: data, total: count };
  },

  async createLog({ vehicleId, component, mileageAtService, notes }) {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .insert({ vehicle_id: vehicleId, component, mileage_at_service: mileageAtService, notes })
      .select('id, component, mileage_at_service, notes, created_at')
      .single();
    if (error) throw error;
    return data;
  },

  async findLastLog(vehicleId, component) {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .select('mileage_at_service, created_at')
      .eq('vehicle_id', vehicleId)
      .eq('component', component)
      .is('deleted_at', null)
      .order('mileage_at_service', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // ─── Schedule ─────────────────────────────────────────────────────────────

  async findScheduleByVehicle(vehicleId) {
    const { data, error } = await supabase
      .from('maintenance_schedule')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('alert_status', { ascending: false }); // OVERDUE first
    if (error) throw error;
    return data;
  },

  async upsertSchedule({
    vehicleId, component, lastServicedKm, baseIntervalKm,
    adjustedIntervalKm, kmDue, alertStatus, humidityAtCalc,
  }) {
    const { data, error } = await supabase
      .from('maintenance_schedule')
      .upsert({
        vehicle_id: vehicleId,
        component,
        last_serviced_km: lastServicedKm,
        base_interval_km: baseIntervalKm,
        adjusted_interval_km: adjustedIntervalKm,
        km_due: kmDue,
        alert_status: alertStatus,
        humidity_at_calc: humidityAtCalc,
        calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'vehicle_id,component' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

module.exports = maintenanceModel;
