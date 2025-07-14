declare module 'quagga' {
	interface QuaggaConfig {
		inputStream: {
			name: string
			type: string
			target: HTMLElement
			constraints: {
				width: { min: number; ideal: number; max: number }
				height: { min: number; ideal: number; max: number }
				facingMode: string
				aspectRatio: { min: number; max: number }
			}
		}
		decoder: {
			readers: string[]
		}
		locate: boolean
	}

	interface CodeResult {
		code: string
		format: string
	}

	interface DetectedResult {
		codeResult: CodeResult
	}

	interface ProcessedResult {
		boxes?: any[]
		box?: any
		codeResult?: CodeResult
		line?: any
	}

	interface QuaggaStatic {
		init(config: QuaggaConfig, callback: (err: any) => void): void
		start(): void
		stop(): void
		pause(): void
		onDetected(callback: (result: DetectedResult) => void): void
		onProcessed(callback: (result: ProcessedResult) => void): void
		canvas: {
			dom: {
				overlay: HTMLCanvasElement
			}
		}
		ImageDebug: {
			drawPath(path: any, options: any, ctx: CanvasRenderingContext2D, style: any): void
		}
	}

	const Quagga: QuaggaStatic
	export = Quagga
}
