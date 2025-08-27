import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import type { ProcessingStatus } from '../shared/interfaces'

export const config: EventConfig = {
  type: 'event',
  name: 'CompletionTracker',
  description: 'Track completion of all resize operations',
  subscribes: ['desktop-resize-complete', 'mobile-resize-complete', 'lowquality-resize-complete'],
  emits: [],
  flows: ['image-processing'],
  input: z.object({
    originalFilename: z.string(),
    uniqueFilename: z.string(),
    format: z.string(),
    originalStorageKey: z.string(),
    originalUrl: z.string(),
    traceId: z.string(),
    uploadedAt: z.string(),
    resizeType: z.string(),
    outputStorageKey: z.string(),
    outputUrl: z.string(),
    completedAt: z.string()
  })
}

interface CompletionData {
  originalFilename: string
  uniqueFilename: string
  format: string
  originalStorageKey: string
  originalUrl: string
  traceId: string
  uploadedAt: string
  resizeType: string
  outputStorageKey: string
  outputUrl: string
  completedAt: string
}

export const handler: Handlers['CompletionTracker'] = async (completionData: CompletionData, { logger, emit, traceId, state }) => {
  const startTime = Date.now()
  
  try {
    logger.info('Processing resize completion', {
      resizeType: completionData.resizeType,
      filename: completionData.originalFilename
    })

    const statusKey = `processing_${traceId}`
    const storedStatus = await state.get(statusKey, 'default')
    let status: ProcessingStatus = storedStatus ? JSON.parse(storedStatus as string) : {
      traceId,
      originalStorageKey: completionData.originalStorageKey,
      desktopComplete: false,
      mobileComplete: false,
      lowqualityComplete: false
    }

    switch (completionData.resizeType) {
      case 'desktop':
        status.desktopComplete = true
        break
      case 'mobile':
        status.mobileComplete = true
        break
      case 'lowquality':
        status.lowqualityComplete = true
        break
    }

    await state.set(statusKey, JSON.stringify(status), 'default')

    logger.info('Updated processing status', { status })

    const allComplete = status.desktopComplete && status.mobileComplete && status.lowqualityComplete

    if (allComplete) {
      status.completedAt = new Date()
      await state.set(statusKey, JSON.stringify(status), 'default')

      logger.info('All processing completed successfully', {
        traceId,
        finalStatus: status,
        processingTimeMs: Date.now() - startTime
      })
    } else {
      logger.info('Waiting for remaining operations', {
        pendingOperations: {
          desktop: !status.desktopComplete,
          mobile: !status.mobileComplete,
          lowquality: !status.lowqualityComplete
        }
      })
    }

  } catch (error) {
    logger.error('Completion tracking failed', { error: error instanceof Error ? error.message : 'Unknown error' })
    throw new Error(`Completion tracking failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}