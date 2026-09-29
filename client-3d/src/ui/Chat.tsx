import { useEffect, useRef, useState } from 'react'
import { useGame, showBubble } from '../state/game'
import { network } from '../net/network'

// the chat of the room (the same messages as in the 2D client), bubbles over the heads
export default function Chat() {
  const chat = useGame((s) => s.chat)
  const focused = useGame((s) => s.chatFocused)
  const sessionId = useGame((s) => s.sessionId)
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focused) input.current?.focus()
  }, [focused])

  useEffect(() => {
    list.current?.scrollTo(0, list.current.scrollHeight)
  }, [chat])

  const send = () => {
    const content = text.trim()
    if (!content) return
    network.sendChat(content)
    if (sessionId) showBubble(sessionId, content)
    setText('')
  }

  return (
    <div className={`chat ${focused ? 'focused' : ''}`}>
      <div className="chat-lines" ref={list}>
        {chat.slice(-60).map((line, i) => (
          <div key={i} className={line.system ? 'system' : ''}>
            <b>{line.author}</b> {line.content}
          </div>
        ))}
      </div>
      <input
        ref={input}
        value={text}
        maxLength={300}
        placeholder="Enter: Nachricht schreiben …"
        onChange={(e) => setText(e.target.value)}
        onFocus={() => useGame.getState().set({ chatFocused: true })}
        onBlur={() => useGame.getState().set({ chatFocused: false })}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') send()
          if (e.key === 'Escape') input.current?.blur()
        }}
      />
    </div>
  )
}
