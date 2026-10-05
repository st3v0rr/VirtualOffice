import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  loadMediaSettings,
  playTestSound,
  saveMediaSettings,
  supportsAudioOutputSelection,
  type MediaSettings,
} from '@skyoffice/media'
import { useMediaSetup } from '@skyoffice/media/react'
import { useGame } from '../state/game'
import { network } from '../net/network'
import Chibi from '../avatar/Chibi'
import { createMotion } from '../avatar/motion'
import type { Avatar } from '../avatar/avatar'
import { office } from '../map/office'
import { toAnim } from '../net/players'
import { clearMyMedia, setMyMedia } from '../media/media'
import { DeviceSelect, MicLevel, Preview, activeDeviceIds, describeMediaError } from './mediaParts'
import {
  JOIN_STEPS,
  NAME_MAX_LENGTH,
  STEP_LABELS,
  autoStartPreview,
  canOpenStep,
  chooseRoom,
  describeMedia,
  describeRoom,
  joinProblem,
  loadRoomChoice,
  mediaOnJoin,
  nextStep,
  previewMessage,
  previousStep,
  rememberMediaChoice,
  restoreStatus,
  restoredRoom,
  restoredRoomForm,
  roomTarget,
  saveRoomChoice,
  setAdvanced,
  stepProblem,
  toggleMedia,
  type JoinForm,
  type JoinStep,
  type RoomForm,
} from './joinFlow'

// The start screen over the rendered office: name and character, room, then camera and
// microphone; the office room is only joined with Beitreten at the end (see joinFlow.ts).

type MyMedia = { stream: MediaStream; settings: MediaSettings } | null

export default function Join() {
  const savedName = useGame((s) => s.name)
  const rooms = useGame((s) => s.rooms)
  const lobby = useGame((s) => s.lobby)
  const connecting = useGame((s) => s.connection === 'connecting')

  // the room of the last visit
  const [savedRoom] = useState(loadRoomChoice)
  const [step, setStep] = useState<JoinStep>('profile')
  const [name, setName] = useState(savedName)
  const [roomDraft, setRoom] = useState<RoomForm>(() => restoredRoomForm(savedRoom))
  // a remembered custom room is shown in the advanced options
  const [advancedDraft, setAdvancedOpen] = useState(() => roomDraft.choice !== 'public')
  // the problem of the step is only shown once the user tried to go on
  const [tried, setTried] = useState(false)
  // the camera/microphone choices, kept when going back to an earlier step
  const [mediaDraft, setMediaDraft] = useState<Partial<MediaSettings>>({})
  const headingRef = useRef<HTMLHeadingElement>(null)
  // set once the user moved between steps, the name field has the focus before
  const moved = useRef(false)

  // a remembered custom room needs the room list to be found again; if it closed
  // meanwhile (or the list can't be loaded) it is the public office until the user picks
  // something else
  const restore = restoreStatus(savedRoom, lobby, rooms)
  const { room, lost } = restoredRoom(roomDraft, savedRoom, restore)
  const advanced = advancedDraft && !lost
  const roomNotice = !lost
    ? null
    : lobby === 'error'
      ? 'Dein zuletzt genutzter Raum kann gerade nicht geladen werden. Du landest im öffentlichen Büro.'
      : 'Dein zuletzt genutzter Raum existiert nicht mehr. Du landest im öffentlichen Büro.'
  // a change of the room starts from what is shown, the fallback included
  const updateRoom = (update: (room: RoomForm) => RoomForm) =>
    setRoom((r) => update(restoredRoom(r, savedRoom, restore).room))

  const form: JoinForm = { name, room, rooms }
  const problem = tried ? stepProblem(step, form) : null

  // a stream left over from an earlier visit of the office (e.g. the connection was
  // lost) is not used without asking again
  useEffect(() => clearMyMedia(), [])

  // the room list is only loaded for a remembered custom room
  useEffect(() => {
    if (restore === 'pending' && lobby === 'idle') network.joinLobby()
  }, [restore, lobby])

  // lead screen readers and the keyboard to the new step
  useEffect(() => {
    if (moved.current) headingRef.current?.focus()
  }, [step])

  const goTo = (target: JoinStep) => {
    if (target === step || !canOpenStep(target, form)) return
    // a failed attempt may have left the camera running; it stops when leaving the step
    if (step === 'media') clearMyMedia()
    moved.current = true
    setTried(false)
    setStep(target)
  }

  const forward = () => {
    if (stepProblem(step, form)) return setTried(true)
    const next = nextStep(step)
    if (next) goTo(next)
  }

  const back = () => {
    const previous = previousStep(step)
    if (previous) goTo(previous)
  }

  const toggleAdvanced = () => {
    const open = !advanced
    setAdvancedOpen(open)
    updateRoom((r) => setAdvanced(r, open))
    // the list of custom rooms needs the lobby, only joined when asked for
    if (open) network.joinLobby()
  }

  // takeMedia hands over the preview stream (or nothing), only once the form is complete
  const join = async (takeMedia: () => MyMedia) => {
    const missing = joinProblem(form)
    if (missing) {
      moved.current = true
      setStep(missing.step)
      setTried(true)
      return
    }
    const trimmed = name.trim()
    localStorage.setItem('skyoffice3d.name', trimmed)
    const game = useGame.getState()
    game.set({ name: trimmed })
    const media = takeMedia()
    if (media) setMyMedia(media.stream, media.settings)
    else clearMyMedia()
    const target = roomTarget(room, rooms)
    const joined = await network.join(
      trimmed,
      game.avatar,
      { x: office.spawn.x, y: office.spawn.y, anim: toAnim(game.avatar.texture, 'idle', 0) },
      target
    )
    // remembered for the next visit: which room, never its password
    if (joined) saveRoomChoice(target.kind === 'public' ? 'public' : (network.room?.roomId ?? ''))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (step !== 'media') forward()
  }

  return (
    <div className="join-layer">
      <form className="join" onSubmit={submit} noValidate aria-busy={connecting}>
        <header className="join-brand">
          <div className="logo" aria-hidden>
            🏢
          </div>
          <div>
            <h1>
              Virtual<span>Office</span>
            </h1>
            <p className="subtitle">Dein Büro im Browser. Komm rein!</p>
          </div>
        </header>

        <ol className="stepper">
          {JOIN_STEPS.map((s, i) => {
            const done = JOIN_STEPS.indexOf(step) > i
            return (
              <li key={s} className={s === step ? 'current' : done ? 'done' : ''}>
                <button
                  type="button"
                  disabled={connecting || !canOpenStep(s, form)}
                  aria-current={s === step ? 'step' : undefined}
                  onClick={() => goTo(s)}
                >
                  <span className="number">{done ? '✓' : i + 1}</span>
                  <span className="label">{STEP_LABELS[s]}</span>
                </button>
              </li>
            )
          })}
        </ol>

        <fieldset className="join-step" disabled={connecting}>
          {step === 'profile' && (
            <ProfileStep headingRef={headingRef} name={name} onName={setName} />
          )}
          {step === 'room' && (
            <RoomStep
              headingRef={headingRef}
              room={room}
              onRoom={updateRoom}
              advanced={advanced}
              onToggleAdvanced={toggleAdvanced}
              notice={roomNotice}
            />
          )}
          {step === 'media' && (
            <MediaStep
              headingRef={headingRef}
              draft={mediaDraft}
              onDraft={(changes) => setMediaDraft((d) => ({ ...d, ...changes }))}
              summary={{ name: name.trim(), room: describeRoom(room, rooms) }}
              connecting={connecting}
              onBack={back}
              onJoin={join}
            />
          )}
        </fieldset>

        {problem && (
          <p className="error" role="alert">
            {problem}
          </p>
        )}

        {step !== 'media' && (
          <div className="join-buttons">
            {previousStep(step) && (
              <button type="button" className="secondary" onClick={back}>
                Zurück
              </button>
            )}
            <button type="submit" className="primary">
              Weiter
            </button>
          </div>
        )}
      </form>
    </div>
  )
}

type HeadingRef = RefObject<HTMLHeadingElement | null>

function StepHeading({ headingRef, children }: { headingRef: HeadingRef; children: string }) {
  return (
    <h2 ref={headingRef} tabIndex={-1}>
      {children}
    </h2>
  )
}

// a static idle pose is enough for the small live preview; no per-frame state changes needed
function AvatarMiniPreview({ avatar }: { avatar: Avatar }) {
  const [motion] = useState(createMotion)
  return (
    <div
      className="avatar-preview-mini"
      role="img"
      aria-label="Charakter-Vorschau: Dein Avatar im Büro"
    >
      <Canvas flat dpr={[1, 2]} camera={{ position: [0, 0.9, 4.4], fov: 30 }}>
        <hemisphereLight args={['#fff4fb', '#cbb8e0', 1.4]} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} color="#fff3e2" />
        <group position={[0, -0.55, 0]}>
          <Chibi avatar={avatar} motion={motion} />
        </group>
      </Canvas>
    </div>
  )
}

function ProfileStep({
  headingRef,
  name,
  onName,
}: {
  headingRef: HeadingRef
  name: string
  onName: (name: string) => void
}) {
  const avatar = useGame((s) => s.avatar)
  return (
    <>
      <StepHeading headingRef={headingRef}>Wer bist du?</StepHeading>
      <label className="field">
        <span>Name</span>
        <input
          autoFocus
          value={name}
          maxLength={NAME_MAX_LENGTH}
          placeholder="Dein Name"
          autoComplete="nickname"
          onChange={(e) => onName(e.target.value)}
        />
      </label>
      <div className="avatar-card">
        <AvatarMiniPreview avatar={avatar} />
        <button
          type="button"
          className="secondary"
          onClick={() => useGame.getState().set({ editorOpen: true })}
        >
          Ändern
        </button>
      </div>
    </>
  )
}

function RoomStep({
  headingRef,
  room,
  onRoom,
  advanced,
  onToggleAdvanced,
  notice,
}: {
  headingRef: HeadingRef
  room: RoomForm
  onRoom: (update: (room: RoomForm) => RoomForm) => void
  advanced: boolean
  onToggleAdvanced: () => void
  notice: string | null
}) {
  const rooms = useGame((s) => s.rooms)
  const lobby = useGame((s) => s.lobby)
  const selected = rooms.find((r) => r.roomId === room.choice)
  const choose = (choice: string) => onRoom((r) => chooseRoom(r, choice))
  const newRoom = (patch: Partial<RoomForm['newRoom']>) =>
    onRoom((r) => ({ ...r, newRoom: { ...r.newRoom, ...patch } }))

  return (
    <>
      <StepHeading headingRef={headingRef}>Wohin möchtest du?</StepHeading>
      {notice && (
        <p className="muted hint" role="status">
          {notice}
        </p>
      )}
      <div className="rooms" role="radiogroup" aria-label="Raum">
        <label className={`room public ${room.choice === 'public' ? 'active' : ''}`}>
          <input
            type="radio"
            checked={room.choice === 'public'}
            onChange={() => choose('public')}
          />
          <span className="room-icon" aria-hidden>
            🏢
          </span>
          <span className="room-text">
            <strong>Öffentliches Büro</strong>
            <span className="muted">Hier treffen sich alle. Empfohlen.</span>
          </span>
        </label>

        <button
          type="button"
          className="link advanced-toggle"
          aria-expanded={advanced}
          onClick={onToggleAdvanced}
        >
          {advanced ? '▾' : '▸'} Anderen Raum wählen oder erstellen
        </button>

        {advanced && (
          <div className="advanced">
            {lobby === 'loading' && <p className="muted">Lade Räume …</p>}
            {lobby === 'error' && (
              <p className="muted">Die Raumliste ist gerade nicht verfügbar.</p>
            )}
            {lobby === 'ready' && rooms.length === 0 && (
              <p className="muted">Noch keine eigenen Räume. Erstelle einen!</p>
            )}
            {rooms.map((r) => (
              <label
                key={r.roomId}
                className={`room ${room.choice === r.roomId ? 'active' : ''}`}
                title={r.description}
              >
                <input
                  type="radio"
                  checked={room.choice === r.roomId}
                  onChange={() => choose(r.roomId)}
                />
                <span className="room-icon" aria-hidden>
                  {r.hasPassword ? '🔒' : '🚪'}
                </span>
                <span className="room-text">
                  <strong>{r.name}</strong>
                  {r.description && <span className="muted">{r.description}</span>}
                </span>
                <span className="room-count" title="Personen im Raum">
                  👥 {r.clients}
                </span>
              </label>
            ))}
            {selected?.hasPassword && (
              <label className="field">
                <span>Passwort für „{selected.name}“</span>
                <input
                  type="password"
                  value={room.password}
                  autoComplete="off"
                  onChange={(e) => {
                    const password = e.target.value
                    onRoom((r) => ({ ...r, password }))
                  }}
                />
              </label>
            )}

            <label className={`room ${room.choice === 'new' ? 'active' : ''}`}>
              <input type="radio" checked={room.choice === 'new'} onChange={() => choose('new')} />
              <span className="room-icon" aria-hidden>
                ✨
              </span>
              <span className="room-text">
                <strong>Eigenen Raum erstellen</strong>
                <span className="muted">Für dein Team, optional mit Passwort.</span>
              </span>
            </label>
            {room.choice === 'new' && (
              <div className="new-room">
                <input
                  value={room.newRoom.name}
                  maxLength={40}
                  placeholder="Name des Raums"
                  aria-label="Name des Raums"
                  onChange={(e) => newRoom({ name: e.target.value })}
                />
                <input
                  value={room.newRoom.description}
                  maxLength={80}
                  placeholder="Beschreibung (optional)"
                  aria-label="Beschreibung"
                  onChange={(e) => newRoom({ description: e.target.value })}
                />
                <input
                  type="password"
                  value={room.newRoom.password}
                  placeholder="Passwort (optional)"
                  aria-label="Passwort"
                  autoComplete="new-password"
                  onChange={(e) => newRoom({ password: e.target.value })}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function MediaStep({
  headingRef,
  draft,
  onDraft,
  summary,
  connecting,
  onBack,
  onJoin,
}: {
  headingRef: HeadingRef
  draft: Partial<MediaSettings>
  onDraft: (changes: Partial<MediaSettings>) => void
  summary: { name: string; room: string }
  connecting: boolean
  onBack: () => void
  onJoin: (takeMedia: () => MyMedia) => void
}) {
  const [autoStart] = useState(() => autoStartPreview({ ...loadMediaSettings(), ...draft }))
  const media = useMediaSetup(draft, describeMediaError, { autoStart })
  const { settings, devices, stream, error, requested, requestAccess, stop } = media

  const update = (changes: Partial<MediaSettings>) => {
    media.updateSettings(changes)
    onDraft(changes)
  }

  const toggle = (kind: 'audio' | 'video') => {
    const result = toggleMedia(settings, kind, { requested, hasStream: !!stream })
    update(result.changes)
    if (result.request) requestAccess()
    // both off: end the preview, so the camera light goes off
    if (result.stop) stop()
  }

  const join = () =>
    onJoin(() => {
      const hasStream = !!stream
      if (rememberMediaChoice(settings, hasStream)) {
        saveMediaSettings(settings)
        useGame.getState().set({ audioOutputId: settings.audioOutputId })
      }
      if (mediaOnJoin(settings, hasStream) === 'use') {
        const acquired = media.release()
        if (acquired) return { stream: acquired, settings }
      }
      stop()
      return null
    })

  // join without camera and microphone, the stored choice stays as it is
  const skip = () =>
    onJoin(() => {
      stop()
      return null
    })

  const active = activeDeviceIds(stream, settings.videoInputId, settings.audioInputId)
  const hasVideo = !!stream && stream.getVideoTracks().length > 0
  const hasAudio = !!stream && stream.getAudioTracks().length > 0
  const using = mediaOnJoin(settings, !!stream) === 'use'
  const anyOn = settings.audioEnabled || settings.videoEnabled
  const connectionError = useGame((s) => (s.connection === 'error' ? s.connectionError : undefined))

  return (
    <>
      <StepHeading headingRef={headingRef}>Kamera &amp; Mikrofon</StepHeading>
      <p className="muted hint">
        Probier hier in Ruhe aus, wie du klingst und aussiehst. Erst mit „Beitreten“ geht es ins
        Büro.
      </p>

      <div className="preview">
        {hasVideo && settings.videoEnabled ? (
          <Preview stream={stream} />
        ) : (
          <span>
            {previewMessage({
              requested,
              hasStream: !!stream,
              error,
              videoEnabled: settings.videoEnabled,
              hasVideo,
            })}
          </span>
        )}
      </div>

      <div className="media-switches">
        <button
          type="button"
          className={`switch ${settings.audioEnabled ? 'on' : ''}`}
          role="switch"
          aria-checked={settings.audioEnabled}
          onClick={() => toggle('audio')}
        >
          {settings.audioEnabled ? '🎙️' : '🔇'} Mikrofon {settings.audioEnabled ? 'an' : 'aus'}
        </button>
        <button
          type="button"
          className={`switch ${settings.videoEnabled ? 'on' : ''}`}
          role="switch"
          aria-checked={settings.videoEnabled}
          onClick={() => toggle('video')}
        >
          {settings.videoEnabled ? '📷' : '🚫'} Kamera {settings.videoEnabled ? 'an' : 'aus'}
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}{' '}
          <button type="button" className="link" onClick={requestAccess}>
            Erneut versuchen
          </button>
        </p>
      )}

      {requested && stream && (
        <div className="devices">
          <DeviceSelect
            label="Kamera"
            devices={devices.videoInputs}
            value={active.video}
            onChange={(videoInputId) => update({ videoInputId })}
          />
          <DeviceSelect
            label="Mikrofon"
            devices={devices.audioInputs}
            value={active.audio}
            onChange={(audioInputId) => update({ audioInputId })}
          />
          {hasAudio && <MicLevel stream={stream} enabled={settings.audioEnabled} />}
          <div className="speaker">
            {supportsAudioOutputSelection ? (
              <DeviceSelect
                label="Lautsprecher"
                devices={devices.audioOutputs}
                value={settings.audioOutputId}
                onChange={(audioOutputId) => update({ audioOutputId })}
              />
            ) : (
              <p className="muted">Dieser Browser nutzt immer den System-Lautsprecher.</p>
            )}
            <button
              type="button"
              title="Testton abspielen"
              onClick={() => playTestSound(settings.audioOutputId)}
            >
              🔔
            </button>
          </div>
        </div>
      )}

      <div className="join-summary">
        <div>
          <span className="muted">Name</span> {summary.name}
        </div>
        <div>
          <span className="muted">Raum</span> {summary.room}
        </div>
        <div className="muted">
          {describeMedia(using ? settings : { audioEnabled: false, videoEnabled: false })}
        </div>
      </div>

      {connectionError && (
        <p className="error" role="alert">
          {connectionError}
        </p>
      )}

      <div className="join-buttons">
        <button type="button" className="secondary" onClick={onBack}>
          Zurück
        </button>
        {anyOn && (
          <button type="button" className="secondary" onClick={skip}>
            Ohne Kamera &amp; Mikro
          </button>
        )}
        <button type="button" className="primary" onClick={join}>
          {connecting ? 'Verbinde …' : 'Beitreten'}
        </button>
      </div>
    </>
  )
}
