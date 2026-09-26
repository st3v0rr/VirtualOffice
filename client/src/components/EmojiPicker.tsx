import { useEffect, useEffectEvent, useRef } from 'react'
import { Picker } from 'emoji-mart'

type Props = {
  onEmojiSelect: (emoji: { native: string }) => void
}

// Thin React wrapper around emoji-mart's <em-emoji-picker> web component.
export default function EmojiPicker({ onEmojiSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleEmojiSelect = useEffectEvent(onEmojiSelect)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const picker = new Picker({
      data: async () => (await import('@emoji-mart/data')).default,
      theme: 'dark',
      categories: ['people', 'nature', 'foods', 'activity', 'places', 'objects', 'symbols'],
      previewPosition: 'none',
      skinTonePosition: 'none',
      onEmojiSelect: (emoji: { native: string }) => handleEmojiSelect(emoji),
    }) as unknown as HTMLElement
    container.appendChild(picker)

    return () => {
      picker.remove()
    }
  }, [])

  return <div ref={containerRef} />
}
