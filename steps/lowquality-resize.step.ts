import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import sharp from 'sharp'
import type { ImageMetadata } from '../shared/interfaces'
import {
  generateStorageKeys,
  getImageStream,
  saveImageStream,
  getImageUrl,
  getResizeConfig,
  getImageFormat
} from '../shared/storage-utils'

export const config: EventConfig = {
  type: 'event',
  name: 'LowQualityResize',
  description: 'Resize uploaded image for fast loading (480px width, 60% quality)',
  subscribes: ['image-saved'],
  emits: ['lowquality-resize-complete'],
  flows: ['image-processing'],
  input: z.object({
    originalFilename: z.string(),
    uniqueFilename: z.string(),
    format: z.string(),
    originalStorageKey: z.string(),
    originalUrl: z.string(),
    traceId: z.string(),
    uploadedAt: z.string()
  })
}

interface ImageResizeInput {
  originalFilename: string
  uniqueFilename: string
  format: string
  originalStorageKey: string
  originalUrl: string
  traceId: string
  uploadedAt: string
}

export const handler: Handlers['LowQualityResize'] = async (imageMetadata: ImageResizeInput, { logger, emit, traceId }) => {
  const startTime = Date.now()
  
  try {
    logger.info('Starting low-quality resize operation', {
      filename: imageMetadata.originalFilename,
      originalKey: imageMetadata.originalStorageKey
    })

    const storageKeys = generateStorageKeys(imageMetadata.uniqueFilename)
    const resizeConfig = getResizeConfig('lowquality')

    const originalStream = await getImageStream(imageMetadata.originalStorageKey)
    
    const format = getImageFormat(imageMetadata.originalFilename)
    const sharpTransform = sharp()
      .resize(resizeConfig.width, null, { 
        withoutEnlargement: true,
        fit: 'inside'
      })
    
    if (format === 'jpeg' || format === 'jpg') {
      sharpTransform.jpeg({ quality: resizeConfig.quality })
    } else if (format === 'png') {
      sharpTransform.png({ quality: resizeConfig.quality })
    } else if (format === 'webp') {
      sharpTransform.webp({ quality: resizeConfig.quality })
    }

    logger.info('Retrieved original image stream from storage', {
      originalFilename: imageMetadata.originalFilename,
      uniqueFilename: imageMetadata.uniqueFilename,
      originalStorageKey: imageMetadata.originalStorageKey
    })

    const resizedStream = originalStream.pipe(sharpTransform)
    const outputStorageKey = await saveImageStream(resizedStream, storageKeys.lowquality)
    const outputUrl = await getImageUrl(outputStorageKey)

    logger.info('Resize operation completed', {
      originalFilename: imageMetadata.originalFilename,
      uniqueFilename: imageMetadata.uniqueFilename,
      originalStorageKey: imageMetadata.originalStorageKey,
      targetWidth: resizeConfig.width,
      quality: resizeConfig.quality,
      outputStorageKey
    })

    await emit({
      topic: 'lowquality-resize-complete',
      data: {
        ...imageMetadata,
        resizeType: 'lowquality',
        outputStorageKey,
        outputUrl,
        completedAt: new Date().toISOString(),
        uploadedAt: imageMetadata.uploadedAt
      }
    } as any)

    logger.info('Low-quality resize completed successfully', {
      originalFilename: imageMetadata.originalFilename,
      uniqueFilename: imageMetadata.uniqueFilename,
      originalStorageKey: imageMetadata.originalStorageKey,
      outputStorageKey,
      outputUrl,
      processingTimeMs: Date.now() - startTime
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Low-quality resize failed', { error: errorMessage })
    throw new Error(`Low-quality resize failed: ${errorMessage}`)
  }
}
