/**
 * Testimonials Configuration
 * Parent and camper testimonials for landing page
 */

export interface Testimonial {
  id: number;
  quote: string;
  author: string;
  role: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 1,
    quote:
      'Coming to Camp Burnt Gin was the first time our daughter felt completely herself around other kids. The staff\'s care and expertise gave us confidence, and seeing her joy was everything.',
    author: 'Sarah M.',
    role: 'Parent of a 2024 Camper',
  },
  {
    id: 2,
    quote:
      'Camp Burnt Gin changed my son\'s life. He made friends, tried new activities, and came home with a newfound confidence we\'d never seen before. The medical support was exceptional.',
    author: 'James T.',
    role: 'Parent of a 2023 Camper',
  },
  {
    id: 3,
    quote:
      'As a parent, my biggest worry was whether my child would be safe and happy. Camp Burnt Gin exceeded every expectation. The care, the activities, the community—it\'s truly special.',
    author: 'Maria L.',
    role: 'Parent of a 2025 Camper',
  },
];
