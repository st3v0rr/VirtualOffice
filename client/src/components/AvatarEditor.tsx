import { useState } from 'react'
import styled from 'styled-components'
import Button from '@mui/material/Button'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import CasinoIcon from '@mui/icons-material/Casino'

import {
  AVATAR_OPTIONS,
  HAIR_COLORS,
  randomAvatar,
  type AvatarDescription,
} from '../../../types/Avatar'
import AvatarPreview, { type PreviewState } from './AvatarPreview'

// fixed avatars to tell two test sessions apart quickly (dev builds only)
const TEST_AVATARS: { label: string; avatar: AvatarDescription }[] = [
  {
    label: 'Test A',
    avatar: {
      body: 'teen_light',
      hair: 'buzzcut',
      hairColor: 'black',
      top: 'tshirt',
      bottom: 'pants',
    },
  },
  {
    label: 'Test B',
    avatar: {
      body: 'female_bronze',
      hair: 'bob',
      hairColor: 'blonde',
      top: 'cardigan',
      bottom: 'formal',
    },
  },
  {
    label: 'Test C',
    avatar: {
      body: 'teen_light',
      hair: 'curly_short',
      hairColor: 'red_tint',
      top: 'polo',
      bottom: 'formal',
    },
  },
  {
    label: 'Test D',
    avatar: {
      body: 'female_bronze',
      hair: 'curly_short',
      hairColor: 'blue_tint',
      top: 'tshirt',
      bottom: 'pants',
    },
  },
]

const LAYERS: { field: keyof AvatarDescription; label: string }[] = [
  { field: 'body', label: 'Körper' },
  { field: 'hair', label: 'Frisur' },
  { field: 'hairColor', label: 'Haarfarbe' },
  { field: 'top', label: 'Oberteil' },
  { field: 'bottom', label: 'Hose' },
]

const PREVIEW_STATES: { state: PreviewState; label: string }[] = [
  { state: 'idle', label: 'Stehen' },
  { state: 'run', label: 'Laufen' },
  { state: 'sit', label: 'Sitzen' },
]

// swatches for the hair color buttons
const HAIR_SWATCHES: Record<(typeof HAIR_COLORS)[number]['id'], string> = {
  dark_brown: '#4a2f1d',
  blonde: '#e3c16f',
  black: '#1b1b1f',
  red_tint: '#d04a2a',
  blue_tint: '#4a7ad0',
}

const Wrapper = styled.div`
  display: flex;
  gap: 20px;
  color: #eee;
`

const PreviewColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`

const Stage = styled.div`
  background: #dbdbe0;
  border-radius: 8px;
  padding: 8px;
`

const Layers = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const Label = styled.div`
  font-size: 12px;
  color: #c2c2c2;
  margin-bottom: 2px;
`

const Swatch = styled.span`
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid #ffffff80;
`

const TestAvatars = styled.div`
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed #ffffff40;
`

type Props = {
  value: AvatarDescription
  onChange: (avatar: AvatarDescription) => void
}

export default function AvatarEditor({ value, onChange }: Props) {
  const [previewState, setPreviewState] = useState<PreviewState>('run')

  return (
    <Wrapper>
      <PreviewColumn>
        <Stage>
          <AvatarPreview avatar={value} state={previewState} />
        </Stage>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={previewState}
          onChange={(_event, state) => state && setPreviewState(state)}
        >
          {PREVIEW_STATES.map(({ state, label }) => (
            <ToggleButton key={state} value={state} sx={{ px: 1, py: 0.25 }}>
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Button
          size="small"
          color="secondary"
          startIcon={<CasinoIcon />}
          onClick={() => onChange(randomAvatar())}
        >
          Zufällig
        </Button>
      </PreviewColumn>
      <Layers>
        {LAYERS.map(({ field, label }) => (
          <div key={field}>
            <Label>{label}</Label>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={value[field]}
              onChange={(_event, id) => id && onChange({ ...value, [field]: id })}
            >
              {AVATAR_OPTIONS[field].map((option) => (
                <ToggleButton
                  key={option.id}
                  value={option.id}
                  title={option.label}
                  sx={{ px: 1, py: 0.25, textTransform: 'none' }}
                >
                  {field === 'hairColor' ? (
                    <Swatch
                      style={{ background: HAIR_SWATCHES[option.id as keyof typeof HAIR_SWATCHES] }}
                    />
                  ) : (
                    option.label
                  )}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
        ))}
        {import.meta.env.DEV && (
          <TestAvatars>
            <Label>Test-Avatare (nur Dev)</Label>
            {TEST_AVATARS.map(({ label, avatar }) => (
              <Button key={label} size="small" onClick={() => onChange(avatar)}>
                {label}
              </Button>
            ))}
          </TestAvatars>
        )}
      </Layers>
    </Wrapper>
  )
}
