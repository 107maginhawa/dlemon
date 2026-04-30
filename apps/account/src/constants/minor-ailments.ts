export interface MinorAilment {
  code: string
  name: string
}

export const MINOR_AILMENTS: MinorAilment[] = [
  { code: 'acne-mild', name: 'Acne (mild)' },
  { code: 'allergic-rhinitis', name: 'Allergic rhinitis' },
  { code: 'aphthous-ulcers', name: 'Aphthous ulcers (canker sores)' },
  { code: 'candidal-stomatitis', name: 'Candidal stomatitis (oral thrush)' },
  { code: 'conjunctivitis', name: 'Conjunctivitis (bacterial, allergic, and viral)' },
  { code: 'dermatitis', name: 'Dermatitis (atopic, eczema, allergic, and contact)' },
  { code: 'diaper-dermatitis', name: 'Diaper dermatitis' },
  { code: 'dysmenorrhea', name: 'Dysmenorrhea' },
  { code: 'gerd', name: 'Gastroesophageal reflux disease (GERD)' },
  { code: 'hemorrhoids', name: 'Hemorrhoids' },
  { code: 'herpes-labialis', name: 'Herpes labialis (cold sores)' },
  { code: 'impetigo', name: 'Impetigo' },
  { code: 'insect-bites-urticaria', name: 'Insect bites and urticaria (hives)' },
  { code: 'musculoskeletal-sprains-strains', name: 'Musculoskeletal sprains and strains' },
  { code: 'nausea-vomiting-pregnancy', name: 'Nausea and vomiting of pregnancy' },
  { code: 'pinworms-threadworms', name: 'Pinworms and threadworms' },
  { code: 'tick-bites-prophylaxis', name: 'Tick bites (post-exposure prophylaxis to prevent Lyme disease)' },
  { code: 'utis', name: 'Uncomplicated urinary tract infections (UTIs)' },
  { code: 'vulvovaginal-candidiasis', name: 'Vulvovaginal candidiasis (yeast infection)' },
]
