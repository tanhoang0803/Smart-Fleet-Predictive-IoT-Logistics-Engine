// Smart-Fleet IoT — useMaintenance Hook
// TanQHoang © 2026

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchVehicleStatus, selectStatusByVehicleId, selectFleetLoading } from '@/redux/fleetSlice';

export function useMaintenance(vehicleId) {
  const dispatch = useDispatch();
  const statusMap = useSelector(selectStatusByVehicleId);
  const loading   = useSelector(selectFleetLoading);

  useEffect(() => {
    if (vehicleId) {
      dispatch(fetchVehicleStatus(vehicleId));
    }
  }, [dispatch, vehicleId]);

  const statusData = vehicleId ? statusMap[vehicleId] : null;

  return {
    schedule:        statusData?.schedule ?? [],
    worstStatus:     statusData?.worstStatus ?? 'NORMAL',
    weather:         statusData?.weather ?? null,
    vehicle:         statusData?.vehicle ?? null,
    loading,
  };
}
