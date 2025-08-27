import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import { Readable } from 'stream'
import type { ResizeConfig, StorageKeys } from './interfaces'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'auto',
  endpoint: process.env.AWS_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  forcePathStyle: true
})

const bucketName = process.env.AWS_S3_BUCKET_NAME!
const publicBaseUrl = process.env.AWS_S3_PUBLIC_URL || process.env.AWS_S3_ENDPOINT

const BUCKET_NAME = process.env.R2_BUCKET_NAME!

export function generateUniqueFilename(originalFilename: string): string {
  const uuid = uuidv4()
  const extension = originalFilename.split('.').pop()
  const nameWithoutExtension = originalFilename.replace(/\.[^/.]+$/, '')
  return `${nameWithoutExtension}_${uuid}.${extension}`
}

export function isValidImageFormat(filename: string): boolean {
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp']
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  return validExtensions.includes(extension)
}

export function getImageFormat(filename: string): string {
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'jpeg'
    case '.png':
      return 'png'
    case '.webp':
      return 'webp'
    default:
      throw new Error(`Unsupported format: ${extension}`)
  }
}

export function generateStorageKeys(uniqueFilename: string): StorageKeys {
  const baseFilename = uniqueFilename.replace(/\.[^/.]+$/, '')
  const extension = uniqueFilename.substring(uniqueFilename.lastIndexOf('.'))
  
  return {
    original: `originals/${uniqueFilename}`,
    desktop: `desktop/${baseFilename}-desktop${extension}`,
    mobile: `mobile/${baseFilename}-mobile${extension}`,
    lowquality: `lowquality/${baseFilename}-lowquality${extension}`
  }
}

export async function saveImageBuffer(
  imageBuffer: Buffer, 
  storageKey: string, 
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storageKey,
    Body: imageBuffer,
    ContentType: contentType,
  })

  await s3Client.send(command)
  return storageKey
}

export async function saveImageStream(
  imageStream: Readable, 
  storageKey: string
): Promise<string> {
  const chunks: Buffer[] = []
  
  return new Promise((resolve, reject) => {
    imageStream.on('data', (chunk) => chunks.push(chunk))
    imageStream.on('error', reject)
    imageStream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks)
        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: storageKey,
          Body: buffer,
          ContentType: 'image/jpeg',
        })

        await s3Client.send(command)
        resolve(storageKey)
      } catch (error) {
        reject(error)
      }
    })
  })
}

export async function getImageStream(storageKey: string): Promise<Readable> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storageKey,
  })

  const response = await s3Client.send(command)
  
  if (!response.Body) {
    throw new Error(`No image found for key: ${storageKey}`)
  }

  return response.Body as Readable
}

export const getImageUrl = async (storageKey: string): Promise<string> => {
  return `${publicBaseUrl}/${bucketName}/${storageKey}`
}

export function getContentTypeFromFilename(filename: string): string {
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}

export function validateBase64ImageData(base64Data: string): void {
  const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '')
  
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
  if (!base64Regex.test(cleanBase64)) {
    throw new Error('Invalid base64 data')
  }

  try {
    Buffer.from(cleanBase64, 'base64')
  } catch (error) {
    throw new Error('Failed to decode base64 data')
  }
}

export function getResizeConfig(type: 'desktop' | 'mobile' | 'lowquality'): ResizeConfig {
  switch (type) {
    case 'desktop':
      return { width: 1920, quality: 90 }
    case 'mobile':
      return { width: 720, quality: 85 }
    case 'lowquality':
      return { width: 480, quality: 60 }
    default:
      throw new Error(`Unknown resize type: ${type}`)
  }
}
