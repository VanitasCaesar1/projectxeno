# DynamicMediaGrid Component

A comprehensive, reusable component for displaying media content with search, filtering, and content discovery features.

## Features

- **Multi-media support**: Handles movies, TV shows, books, anime, and manga
- **Search integration**: Debounced search with media type filtering
- **Content sections**: Popular, Trending, Top Rated, and Recommended content
- **Advanced filtering**: Year range, rating, and genre filters
- **Responsive design**: Mobile-first responsive grid layout
- **Infinite scroll**: Automatic loading of more content
- **Skeleton loading**: Smooth loading states
- **Error handling**: Graceful error states with retry options

## Usage

### Basic Usage

```astro
---
import DynamicMediaGrid from '../components/DynamicMediaGrid.astro';
---

<DynamicMediaGrid 
  mediaType="movie"
  showSearch={true}
  showFilters={true}
/>
```

### Custom Sections

```astro
---
import DynamicMediaGrid from '../components/DynamicMediaGrid.astro';

const customSections = [
  { id: 'action', title: 'Action Movies', type: 'popular', query: 'action' },
  { id: 'comedy', title: 'Comedy Movies', type: 'popular', query: 'comedy' },
  { id: 'drama', title: 'Drama Movies', type: 'popular', query: 'drama' }
];
---

<DynamicMediaGrid 
  mediaType="movie"
  sections={customSections}
  showSearch={true}
  showFilters={true}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mediaType` | `'movie' \| 'tv' \| 'book' \| 'anime' \| 'manga'` | Required | The type of media to display |
| `initialContent` | `SearchResult[]` | `[]` | Initial content to display |
| `showSearch` | `boolean` | `true` | Whether to show the search bar |
| `showFilters` | `boolean` | `true` | Whether to show filter controls |
| `sections` | `ContentSection[]` | Auto-generated | Custom content sections |
| `class` | `string` | `''` | Additional CSS classes |

## Content Sections

Content sections are automatically generated based on the media type, but can be customized:

### Default Sections

- **Popular**: Most popular content for the media type
- **Trending**: Currently trending content
- **Top Rated**: Highest rated content

### Custom Sections

```typescript
interface ContentSection {
  id: string;
  title: string;
  type: 'popular' | 'trending' | 'top_rated' | 'recommended';
  query?: string;
  filters?: Record<string, any>;
}
```

## Search and Filtering

### Search Features
- Debounced input (300ms delay)
- Media type specific filtering
- Real-time results
- Empty state handling

### Filter Options
- **Year Range**: Filter by release/publication year
- **Min Rating**: Filter by minimum rating
- **Apply/Clear**: Easy filter management

## Integration with Existing Components

The component integrates seamlessly with:

- **MediaCard**: For consistent media item display
- **AddToListButton**: For list management functionality
- **LazyImage**: For optimized image loading
- **InfiniteScroll**: For pagination
- **SkeletonLoader**: For loading states

## API Integration

Uses the existing `/api/search` endpoint with support for:
- Multi-API search (TMDB, Open Library, Jikan)
- Advanced filtering
- Pagination
- Error handling

## Responsive Design

- Mobile-first approach
- Responsive grid layout (1-4 columns based on screen size)
- Touch-friendly controls
- Optimized for all device sizes

## Performance Features

- **Debounced search**: Reduces API calls
- **Lazy loading**: Images load as needed
- **Infinite scroll**: Smooth pagination
- **Caching**: Leverages existing cache system
- **Skeleton loading**: Perceived performance improvement

## Error Handling

- **API failures**: Graceful degradation with retry options
- **Network issues**: Offline-friendly error states
- **Empty results**: Helpful empty state messages
- **Loading states**: Clear loading indicators

## Accessibility

- **Keyboard navigation**: Full keyboard support
- **Screen reader friendly**: Proper ARIA labels
- **Focus management**: Logical tab order
- **High contrast**: Supports dark mode

## Browser Support

- Modern browsers with ES6+ support
- Progressive enhancement for older browsers
- Responsive design for all screen sizes

## Dependencies

- Astro framework
- Existing MediaCard component
- Search API endpoint
- Tailwind CSS for styling