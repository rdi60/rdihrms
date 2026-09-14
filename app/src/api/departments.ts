import { supabase } from '../lib/supabase';
import type { Department, Profile } from '../types';

export async function listDepartments(): Promise<Department[]> {
  const { data, error } = await supabase.from('departments').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createDepartment(name: string): Promise<Department> {
  const { data, error } = await supabase.from('departments').insert({ name }).select().single();
  if (error) throw error;
  return data;
}

export async function listManagers(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').eq('role', 'manager').order('employee_code');
  if (error) throw error;
  return data ?? [];
}

/** Department ids the current signed-in manager is responsible for. Empty means unscoped (sees everyone). */
export async function listMyManagedDepartmentIds(managerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('manager_departments')
    .select('department_id')
    .eq('manager_id', managerId);
  if (error) throw error;
  return (data ?? []).map((r) => r.department_id);
}

export async function listDepartmentManagerIds(departmentId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('manager_departments')
    .select('manager_id')
    .eq('department_id', departmentId);
  if (error) throw error;
  return (data ?? []).map((r) => r.manager_id);
}

export async function assignManagerToDepartment(managerId: string, departmentId: string): Promise<void> {
  const { error } = await supabase.from('manager_departments').insert({ manager_id: managerId, department_id: departmentId });
  if (error) throw error;
}

export async function removeManagerFromDepartment(managerId: string, departmentId: string): Promise<void> {
  const { error } = await supabase
    .from('manager_departments')
    .delete()
    .eq('manager_id', managerId)
    .eq('department_id', departmentId);
  if (error) throw error;
}

export async function setProfileDepartment(profileId: string, departmentId: string | null): Promise<void> {
  const { error } = await supabase.from('profiles').update({ department_id: departmentId }).eq('id', profileId);
  if (error) throw error;
}
