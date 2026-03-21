// Smart-Fleet IoT — User Model
// TanQHoang © 2026

const { supabase } = require('../utils/supabaseClient');

const userModel = {
  async findBySupabaseUid(supabaseUid) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('supabase_uid', supabaseUid)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async findById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, fcm_token, created_at')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create({ supabaseUid, email, name }) {
    const { data, error } = await supabase
      .from('users')
      .insert({ supabase_uid: supabaseUid, email, name })
      .select('id, email, name')
      .single();
    if (error) throw error;
    return data;
  },

  async updateFcmToken(userId, fcmToken) {
    const { error } = await supabase
      .from('users')
      .update({ fcm_token: fcmToken, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;
  },

  async clearFcmToken(userId) {
    const { error } = await supabase
      .from('users')
      .update({ fcm_token: null, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;
  },
};

module.exports = userModel;
