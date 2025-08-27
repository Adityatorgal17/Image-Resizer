export interface ImageMetadata {
  originalFilename: string
  uniqueFilename: string
  format: string
  originalStorageKey: string
  originalUrl: string
  traceId: string
  uploadedAt: Date
}

export interface ProcessingStatus {
  traceId: string
  originalStorageKey: string
  desktopComplete: boolean
  mobileComplete: boolean
  lowqualityComplete: boolean
  completedAt?: Date
}

export interface ResizeConfig {
  width: number
  quality: number
}

export interface StorageKeys {
  original: string
  desktop: string
  mobile: string
  lowquality: string
}
