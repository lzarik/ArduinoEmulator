// The people on the "Meet the Team" page, in order. Photos live in public/team/ and are cropped square;
// `focus` is the point of the photo kept in the middle of the crop (as a CSS object-position), and `zoom`
// crops in further around that point, for photos where the person is small in the frame.
// Leave role or bio empty to leave it off the card.

export interface TeamMember {
  name: string
  role: string
  bio: string
  /** Path under public/, e.g. '/team/aidan-gildea.jpg' */
  photo: string
  focus: string
  zoom?: number
}

export const TEAM: TeamMember[] = [
  {
    name: 'Aidan Gildea',
    role: '',
    bio: '',
    photo: '/team/aidan-gildea.jpg',
    focus: '46% 56%',
    zoom: 1.9,
  },
  {
    name: 'Liz Zarikyan',
    role: '',
    bio: '',
    photo: '/team/liz-zarikyan.jpg',
    focus: '50% 30%',
  },
  {
    name: 'Ariana Dadgostar',
    role: '',
    bio: '',
    photo: '/team/ariana-dadgostar.jpg',
    focus: '50% 35%',
  },
]
