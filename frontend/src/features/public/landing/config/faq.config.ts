/**
 * FAQ Configuration
 * Frequently asked questions for landing page
 */

export interface FAQItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'Who is eligible to attend Camp Burnt Gin?',
    answer:
      'Camp Burnt Gin welcomes children and young adults ages 7-16 with special health care needs. Our program is designed to provide a safe, supportive, and joyful camp experience for campers with a wide range of medical conditions and care requirements.',
  },
  {
    question: 'What does the application process involve?',
    answer:
      'The application process includes creating an account, completing your child\'s profile with basic information and medical details, and digitally signing the application. Our team reviews each application carefully to ensure we can provide appropriate care and support.',
  },
  {
    question: 'Is there a cost to attend?',
    answer:
      'Camp Burnt Gin is committed to accessibility. We offer need-based financial assistance and scholarships. Cost should never be a barrier to attendance. Please contact us to discuss your family\'s situation.',
  },
  {
    question: 'What medical information is required?',
    answer:
      'We require comprehensive medical information including diagnosis, current medications, allergies, emergency contacts, and physician information. This ensures our medical staff can provide appropriate care tailored to each camper\'s needs.',
  },
  {
    question: 'How long does the review process take?',
    answer:
      'Applications are typically reviewed within 2-3 weeks of submission. You will receive email notifications at each stage of the process. Our team may reach out for additional information if needed.',
  },
  {
    question: 'What happens if a session is full?',
    answer:
      'If your preferred session reaches capacity, you can join the waitlist or select an alternative session. We maintain waitlists and will notify you immediately if a spot becomes available.',
  },
  {
    question: 'Can I apply to multiple sessions?',
    answer:
      'Yes, you may apply to multiple sessions if you\'re interested in attending more than one camp session during the summer. Each session requires a separate application.',
  },
];
