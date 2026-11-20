export type TaskCategory = 'Personal' | 'Trabajo' | 'Estudio';
export type TaskPriority = 'Baja' | 'Media' | 'Alta';

export interface TaskLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  city?: string;
  country?: string;
  timestamp?: number;
}

export interface TaskWeather {
  temperature?: number;
  weatherCode?: number;
  description?: string;
  windSpeed?: number;
}

export interface Task {
  id: number;
  userId: string;
  text: string;
  description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  completed: boolean;
  createdAt: number;
  updatedAt?: number;
  imageUrl?: string;
  imageFormat?: string;
  location?: TaskLocation;
  weather?: TaskWeather;
  synced?: boolean;
  remoteId?: number | string;
}

export interface CreateTaskDto {
  text: string;
  description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  imageUrl?: string;
  imageFormat?: string;
  location?: TaskLocation;
  weather?: TaskWeather;
}
