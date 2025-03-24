import api from './api';
// @ts-ignore
import { Asset, AssetCreate, AssetUpdate } from '../types/asset';

/**
 * 获取资产列表
 * @param params 筛选参数
 * @returns 资产列表
 */
export const getAssets = async (params?: Record<string, any>): Promise<Asset[]> => {
  try {
    const response = await api.get('/api/v1/assets', { params });
    return response.data;
  } catch (error) {
    console.error('获取资产列表失败', error);
    return [];
  }
};

/**
 * 获取资产详情
 * @param id 资产ID
 * @returns 资产详情
 */
export const getAssetById = async (id: number): Promise<Asset | null> => {
  try {
    const response = await api.get(`/api/v1/assets/${id}`);
    return response.data;
  } catch (error) {
    console.error(`获取资产 ID: ${id} 详情失败`, error);
    return null;
  }
};

/**
 * 创建新资产
 * @param asset 资产数据
 * @returns 创建后的资产
 */
export const createAsset = async (asset: AssetCreate): Promise<Asset | null> => {
  try {
    const response = await api.post('/api/v1/assets', asset);
    return response.data;
  } catch (error) {
    console.error('创建资产失败', error);
    return null;
  }
};

/**
 * 更新资产
 * @param id 资产ID
 * @param asset 资产更新数据
 * @returns 更新后的资产
 */
export const updateAsset = async (id: number, asset: AssetUpdate): Promise<Asset | null> => {
  try {
    const response = await api.put(`/api/v1/assets/${id}`, asset);
    return response.data;
  } catch (error) {
    console.error(`更新资产 ID: ${id} 失败`, error);
    return null;
  }
};

/**
 * 删除资产
 * @param id 资产ID
 * @returns 操作结果
 */
export const deleteAsset = async (id: number): Promise<boolean> => {
  try {
    await api.delete(`/api/v1/assets/${id}`);
    return true;
  } catch (error) {
    console.error(`删除资产 ID: ${id} 失败`, error);
    return false;
  }
};

/**
 * 根据地址查找资产
 * @param address 资产地址
 * @returns 找到的资产或null
 */
export const findAssetByAddress = async (address: string): Promise<Asset | null> => {
  try {
    const response = await api.get('/api/v1/assets/lookup/by-address', { params: { address } });
    return response.data;
  } catch (error) {
    console.error(`查找地址为 ${address} 的资产失败`, error);
    return null;
  }
}; 