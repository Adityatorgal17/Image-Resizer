import {ApiRouteConfig, Handlers} from 'motia'
import {z} from 'zod'
import type { ImageMetadata } from '../shared/interfaces'
import {
    generateUniqueFilename,
    isValidImageFormat,
    getImageFormat,
    generateStorageKeys,
    saveImageBuffer,
    getImageUrl,
    validateBase64ImageData,
    getContentTypeFromFilename
} from '../shared/storage-utils'

const uploadRequestSchema = z.object({
  filename: z.string(),
  data: z.string()
})

export const config: ApiRouteConfig = {
    type: 'api',
    name:'UploadImage',
    description:'Upload and save image,then trigger parallel resize operations',
    method: 'POST',
    path: '/upload-image',
    emits: ['image-saved'],
    flows: ['image-processing']
}

export const handler: Handlers['UploadImage'] = async (req, {logger, emit, traceId}) => {
    try {
    let filename: string
    let imageBuffer: Buffer
    
    const validationResult = uploadRequestSchema.safeParse(req.body)
    if (!validationResult.success) {
      return {
        status: 400,
        body: {
          error: 'Invalid request',
          details: 'Please provide JSON with filename and base64 data'
        }
      }
    }
    
    const { filename: requestFilename, data } = validationResult.data
    filename = requestFilename
    const base64Data = data.replace(/^data:image\/[a-z]+;base64,/, '')
    imageBuffer = Buffer.from(base64Data, 'base64')
    logger.info('Starting image upload process', { filename, fileSize: imageBuffer.length })

    if (!isValidImageFormat(filename)) {
      logger.warn('Invalid image format', { filename })
      return {
        status: 400,
        body: {
          error: 'Invalid image format',
          details: 'Only JPEG, PNG, and WebP formats are supported'
        }
      }
    }

    if (imageBuffer.length > 50 * 1024 * 1024) {
      logger.warn('File too large', { fileSize: imageBuffer.length })
      return {
        status: 400,
        body: {
          error: 'File too large', 
          details: 'Maximum file size is 50MB'
        }
      }
    }

    validateBase64ImageData(data)

    const uniqueFilename = generateUniqueFilename(filename)
    const storageKeys = generateStorageKeys(uniqueFilename)
    const format = getImageFormat(filename)

    logger.info('Generated storage keys', {
      uniqueFilename,
      originalKey: storageKeys.original,
      format
    })

    const contentType = getContentTypeFromFilename(filename)
    const originalStorageKey = await saveImageBuffer(imageBuffer, storageKeys.original, contentType)
    const originalUrl = await getImageUrl(originalStorageKey)

    logger.info('Image saved to storage', { originalStorageKey, originalUrl })

    const imageMetadata: ImageMetadata = {
      originalFilename: filename,
      uniqueFilename,
      format,
      originalStorageKey,
      originalUrl,
      traceId,
      uploadedAt: new Date()
    }

    await emit({
      topic: 'image-saved',
      data: {
        ...imageMetadata,
        uploadedAt: imageMetadata.uploadedAt.toISOString()
      }
    } as any);

    return {
      status: 200,
      body: {
        message: 'Image uploaded successfully and processing started',
        traceId,
        imageMetadata: {
          ...imageMetadata,
          uploadedAt: imageMetadata.uploadedAt.toISOString()
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Upload failed', { error: errorMessage })
    return {
      status: 500,
      body: { error: 'Internal server error' }
    }
  }
}