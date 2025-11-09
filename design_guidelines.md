# Design Guidelines: Ascend - AI-Powered Study Platform

## Design Approach
**Reference-Based Approach**: Drawing from Notion (clean document interface), Duolingo (gamification elements), and Khan Academy (learning dashboard). This experience-focused application requires visual appeal to drive engagement while maintaining functional clarity for productivity tools.

## Core Design Elements

### Typography
- **Primary Font**: Inter for UI elements, body text, and data displays
- **Secondary Font**: Poppins for headings, hero sections, and emphasis
- **Hierarchy**:
  - Hero/Display: Poppins Bold, 48px (mobile: 32px)
  - Page Headings: Poppins SemiBold, 32px (mobile: 24px)
  - Section Titles: Poppins Medium, 24px (mobile: 20px)
  - Card Headers: Inter SemiBold, 18px
  - Body Text: Inter Regular, 16px
  - Labels/Captions: Inter Medium, 14px
  - Small Text: Inter Regular, 12px

### Layout System
**Spacing Units**: Use Tailwind spacing of 2, 4, 6, 8, 12, 16, 20, 24 for consistent rhythm
- Component padding: p-4 to p-6
- Section spacing: py-12 to py-20
- Card spacing: p-6
- Gap between elements: gap-4 to gap-6

**Grid System**:
- Dashboard: 3-column grid (lg:grid-cols-3, md:grid-cols-2, grid-cols-1)
- Leaderboards: 2-column split (stats left, rankings right)
- Flashcards: 2-3 column masonry layout
- Quiz: Single column centered max-w-3xl

### Color Application
- **Primary Actions**: #6366F1 (indigo) - CTAs, active states, focus indicators
- **Gamification**: #8B5CF6 (purple) - badges, streaks, achievements
- **Success States**: #10B981 (emerald) - completed tasks, correct answers, progress
- **Warnings**: #F59E0B (amber) - concentration mode alerts, timer notifications
- **Accent**: #EC4899 (pink) - leaderboard highlights, special features
- **Background**: #F8FAFC (slate-50) - main canvas
- **Text**: #1E293B (slate-800) - primary text, headers
- **Cards**: White backgrounds with subtle shadow (shadow-md)

### Component Library

**Navigation**:
- Persistent sidebar (w-64) with collapsible mobile drawer
- Navigation items with icon + label, hover state with indigo background
- Active state: bold text + indigo background + left border accent
- Logo at top, user profile at bottom

**Cards**:
- White background, rounded-xl borders
- shadow-md with hover:shadow-lg transition
- p-6 internal padding
- Header with icon + title + action button pattern

**Dashboard Widgets**:
- Stat cards: Large number display + label + trend indicator
- Progress rings: Circular progress for streaks and goals
- Activity feed: Timeline-style list with timestamps
- Quick actions: Icon buttons in grid layout

**Leaderboard**:
- Glassmorphism effect: backdrop-blur-lg with semi-transparent white background
- Top 3 users: Larger cards with medal icons (gold, silver, bronze)
- Rank list: Compact rows with avatar, name, score, position indicator
- Current user highlighted with indigo border

**Study Tools**:
- PDF viewer: Split view with document on left, chat on right
- Flashcard: Flip animation on card with front/back states
- Quiz: Progress bar at top, question card center, answer buttons below
- Mind map: Interactive node-based diagram with zoom controls
- Pomodoro: Large circular timer with start/pause controls

**Forms**:
- Input fields: border-gray-300, focus:border-indigo-500, focus:ring-2 focus:ring-indigo-200
- Labels: Inter Medium, 14px, text-slate-700
- Buttons: Rounded-lg, px-6 py-3, shadow-sm
- File upload: Dashed border dropzone with icon and instructions

**Gamification Elements**:
- Achievement badges: Circular icons with glassmorphism background
- Streak counter: Flame icon + number with gradient background
- Level indicator: Progress bar with XP display
- Daily goal: Circular progress ring with percentage

### Animations
**Minimal Motion**:
- Card hover: scale(1.02) transition-transform duration-200
- Button press: scale(0.98) active state
- Modal entrance: fade-in with slight scale-up
- Page transitions: Simple fade between routes
- Tab switch alert: Shake animation for concentration mode violations

### Images
**Landing Page Hero**: 
- Full-width hero image showing students studying with laptops/tablets in modern setting
- Overlay: Dark gradient (from-black/60 to-transparent) for text readability
- Buttons on hero: Blurred background (backdrop-blur-md bg-white/20)

**Dashboard Illustrations**:
- Empty states: Friendly illustrations for "no documents uploaded" or "no quizzes completed"
- Achievement unlocked: Celebratory graphics for milestones

**Feature Showcases**:
- Screenshots of AI chat, flashcards, mind maps in action
- Product demo images showing interface highlights

### Page-Specific Layouts

**Landing Page**:
- Hero: Full viewport with background image, centered heading + subheading + dual CTAs
- Features: 3-column grid showcasing AI tools with icons
- How It Works: Numbered steps in horizontal flow
- Leaderboard Preview: Glassmorphism card with sample rankings
- Testimonials: 2-column cards with student quotes
- Footer: 4-column layout (product, resources, company, social)

**Dashboard**:
- Top bar: Greeting + quick stats (study time today, streak, rank)
- 3-column grid: Study stats, Recent documents, Upcoming tasks
- Activity timeline below grid
- Floating Pomodoro timer widget (bottom-right)

**Document Viewer**:
- 60/40 split: PDF viewer left, AI tools sidebar right
- Tools tabs: Chat, Flashcards, Quiz, Mind Map, Summary
- Sticky header with document name and actions

**Concentration Mode**:
- Fullscreen overlay when active
- Timer display center-top
- Tab switch warning: Modal with beep sound indicator
- Minimalist interface to reduce distractions