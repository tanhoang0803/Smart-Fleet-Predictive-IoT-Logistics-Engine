// Smart-Fleet IoT — Vehicle Model
// TanQHoang © 2026

const { supabase } = require('../utils/supabaseClient');

const vehicleModel = {
  async findAllByOwner(ownerId, { page = 1, limit = 20 } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact' })
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { items: data, total: count };
  },

  async findById(id, ownerId) {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async create({ ownerId, model, plateNumber, mileageCurrent, fuelType, lat, lon }) {
    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        owner_id: ownerId,
        model: model || 'Honda Wave RSX',
        plate_number: plateNumber,
        mileage_current: mileageCurrent || 0,
        fuel_type: fuelType || 'E10',
        lat,
        lon,
      })
      .select('id, model, plate_number, mileage_current, fuel_type')
      .single();
    if (error) throw error;
    return data;
  },

  async updateMileage(id, ownerId, mileageCurrent) {
    const { data, error } = await supabase
      .from('vehicles')
      .update({ mileage_current: mileageCurrent, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .select('id, mileage_current')
      .single();
    if (error) throw error;
    return data;
  },

  async softDelete(id, ownerId) {
    const { error } = await supabase
      .from('vehicles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', ownerId);
    if (error) throw error;
  },
};

module.exports = vehicleModel;
