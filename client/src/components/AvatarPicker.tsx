import { useState } from 'react'
import styled from 'styled-components'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'

import Adam from '../images/login/Adam_login.png'
import Ash from '../images/login/Ash_login.png'
import Lucy from '../images/login/Lucy_login.png'
import Nancy from '../images/login/Nancy_login.png'

export const avatars = [
  { name: 'adam', img: Adam },
  { name: 'ash', img: Ash },
  { name: 'lucy', img: Lucy },
  { name: 'nancy', img: Nancy },
]

export function randomAvatar() {
  return avatars[Math.floor(Math.random() * avatars.length)].name
}

const Wrapper = styled.div`
  --swiper-navigation-size: 24px;

  .swiper {
    width: 160px;
    height: 220px;
    border-radius: 8px;
    overflow: hidden;
  }

  .swiper-slide {
    width: 160px;
    height: 220px;
    background: #dbdbe0;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .swiper-slide img {
    display: block;
    width: 95px;
    height: 136px;
    object-fit: contain;
  }
`

type Props = {
  value: string
  onChange: (avatar: string) => void
}

export default function AvatarPicker({ value, onChange }: Props) {
  // the slider is uncontrolled, it only needs the avatar to start with
  const [initialSlide] = useState(() =>
    Math.max(
      0,
      avatars.findIndex((avatar) => avatar.name === value)
    )
  )

  return (
    <Wrapper>
      <Swiper
        modules={[Navigation]}
        navigation
        spaceBetween={0}
        slidesPerView={1}
        initialSlide={initialSlide}
        onSlideChange={(swiper) => onChange(avatars[swiper.activeIndex].name)}
      >
        {avatars.map((avatar) => (
          <SwiperSlide key={avatar.name}>
            <img src={avatar.img} alt={avatar.name} />
          </SwiperSlide>
        ))}
      </Swiper>
    </Wrapper>
  )
}
