import type { ObjectDetector } from './ObjectDetector'

import { pipeline, RawImage } from '@huggingface/transformers'

type KeyedDetect = {
  key: string
  detect: Function | null
}

const yoloTiny = 'Xenova/yolos-tiny'
const yoloSmall = 'Xenova/yolos-small'

const supportedModels = new Set([yoloTiny, yoloSmall])

export class YoloObjectDetector extends EventTarget implements ObjectDetector {
  private objectDetector: KeyedDetect = {
    key: '',
    detect: null,
  }

  private _isLoading = false
  get isLoading() {
    return this._isLoading
  }
  private set isLoading(value) {
    this._isLoading = value
    this.dispatchEvent(new CustomEvent('loading', { detail: value }))
  }

  private _isDetecting = false
  get isDetecting() {
    return this._isDetecting
  }
  private set isDetecting(value) {
    this._isDetecting = value
    this.dispatchEvent(new CustomEvent('detecting', { detail: value }))
  }

  async load(key: string = yoloTiny) {
    if (!supportedModels.has(key)) {
      throw new Error(`${key} model is not supported. Select any of ${supportedModels}`)
    }

    try {
      console.time('load-detector')
      this.isLoading = true
      if (this.objectDetector.key != key) {
        const detect = await pipeline('object-detection', key, {
          dtype: 'q8',
          device: 'webgpu',
        })
        this.objectDetector = {
          key: key,
          detect,
        }
      }
    } finally {
      console.timeEnd('load-detector')
      this.isLoading = false
    }
  }

  async detect(imageData: string | HTMLCanvasElement) {
    const detect = this.objectDetector.detect
    if (!detect) {
      throw new Error('No detector is set')
    }

    const detectObjectsInImage = async (data: string | RawImage) => {
      const detected = await detect(data, {
        pooling: 'cls', // Use CLS token pooling. Other options: 'mean', 'max'
      })
      return detected
    }

    try {
      console.time('object-detection')
      this.isDetecting = true

      if (typeof imageData === 'string') {
        return detectObjectsInImage(imageData)
      } else if (imageData instanceof HTMLCanvasElement) {
        const rawImage = RawImage.fromCanvas(imageData)
        return detectObjectsInImage(rawImage)
      } else {
        throw new Error(`${typeof imageData} is not yet supported for object detection`)
      }
    } finally {
      console.timeEnd('object-detection')
      this.isDetecting = false
    }
  }
}
