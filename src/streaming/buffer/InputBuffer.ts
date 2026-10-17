export interface InputBuffer {
  push: (chunk: string) => void
  flatten: () => void
  flush: (position: number) => void
  charAt: (index: number) => string
  charCodeAt: (index: number) => number
  substring: (start: number, end: number) => string
  length: () => number
  currentLength: () => number
  currentBufferSize: () => number
  isEnd: (index: number) => boolean
  close: () => void
}

export function createInputBuffer(): InputBuffer {
  return new StringInputBuffer()
}

// Implemented as a class (rather than closures) so all buffers share the same
// methods, which allows the JavaScript engine to inline the hot charAt and
// charCodeAt calls in the parser.
class StringInputBuffer implements InputBuffer {
  private buffer = ''
  private flatBuffer = '' // the buffer without the recently pushed chunks
  private pushedChunks: string[] = []
  private offset = 0
  private _currentLength = 0
  private closed = false

  private ensure(index: number) {
    if (index < this.offset) {
      throw new Error(`${indexOutOfRangeMessage} (index: ${index}, offset: ${this.offset})`)
    }

    if (index >= this._currentLength) {
      if (!this.closed) {
        throw new Error(`${indexOutOfRangeMessage} (index: ${index})`)
      }
    }
  }

  push(chunk: string) {
    this.buffer += chunk
    this.pushedChunks.push(chunk)
    this._currentLength += chunk.length
  }

  /**
   * Turn the buffer into a flat string, which is much faster to read character
   * by character than the concatenated string created when pushing chunks.
   * Joining creates a flat string, whereas reading a concatenated string only
   * flattens it into a slower, indirect representation.
   */
  flatten() {
    if (this.pushedChunks.length > 0) {
      this.buffer = [this.flatBuffer, ...this.pushedChunks].join('')
      this.flatBuffer = this.buffer
      this.pushedChunks = []
    }
  }

  flush(position: number) {
    if (position > this._currentLength) {
      return
    }

    this.flatten()
    this.buffer = this.buffer.substring(position - this.offset)
    this.flatBuffer = this.buffer
    this.offset = position
  }

  charAt(index: number): string {
    this.ensure(index)

    return this.buffer.charAt(index - this.offset)
  }

  charCodeAt(index: number): number {
    this.ensure(index)

    return this.buffer.charCodeAt(index - this.offset)
  }

  substring(start: number, end: number): string {
    this.ensure(end - 1) // -1 because end is excluded
    this.ensure(start)

    return this.buffer.slice(start - this.offset, end - this.offset)
  }

  length(): number {
    if (!this.closed) {
      throw new Error('Cannot get length: input is not yet closed')
    }

    return this._currentLength
  }

  currentLength(): number {
    return this._currentLength
  }

  currentBufferSize(): number {
    return this.buffer.length
  }

  isEnd(index: number): boolean {
    if (!this.closed) {
      this.ensure(index)
    }

    return index >= this._currentLength
  }

  close() {
    this.closed = true
  }
}

const indexOutOfRangeMessage = 'Index out of range, please configure a larger buffer size'
