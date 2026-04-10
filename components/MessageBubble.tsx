import { View, Text, Pressable } from 'react-native';
import { CitationChip } from './CitationChip';
import { RefusalBanner } from './RefusalBanner';
import type { FakeCitation, FakeMessage } from '@/lib/fixtures';

interface MessageBubbleProps {
  message: FakeMessage;
  onCitationPress?: (c: FakeCitation) => void;
}

export function MessageBubble({ message, onCitationPress }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (message.refused) {
    return <RefusalBanner message={message.content} />;
  }

  return (
    <View className={`mb-4 max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}>
      <View
        className={`rounded-xl2 px-4 py-3 ${
          isUser
            ? 'bg-nile-700'
            : 'bg-parchment-100 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700'
        }`}
      >
        <Text
          className={`text-[15px] leading-snug ${
            isUser ? 'text-parchment-50' : 'text-nile-900 dark:text-parchment-100'
          }`}
        >
          {renderWithCitationMarkers(message.content, message.citations, onCitationPress, isUser)}
        </Text>
      </View>
      <Text
        className={`mt-1 text-[11px] text-parchment-600 dark:text-parchment-500 ${isUser ? 'text-right' : 'text-left'}`}
      >
        {message.createdAt}
      </Text>
    </View>
  );
}

/**
 * Inline citation markers like "[1]" and "[2]" in the message content are
 * replaced with pressable chips. In commit 2 this will be driven by real
 * citation blocks from Claude's Citations API.
 */
function renderWithCitationMarkers(
  content: string,
  citations: FakeCitation[] | undefined,
  onCitationPress: ((c: FakeCitation) => void) | undefined,
  isUser: boolean,
) {
  if (!citations || citations.length === 0) {
    return content;
  }
  const parts = content.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = /^\[(\d+)\]$/.exec(part);
    if (!match) {
      return (
        <Text key={i} className={isUser ? 'text-parchment-50' : 'text-nile-900 dark:text-parchment-100'}>
          {part}
        </Text>
      );
    }
    const idx = parseInt(match[1], 10) - 1;
    const citation = citations[idx];
    if (!citation) return <Text key={i}>{part}</Text>;
    return (
      <Text
        key={i}
        onPress={() => onCitationPress?.(citation)}
        className="font-semibold text-incense-600 dark:text-incense-300"
      >
        {' '}[{idx + 1}]
      </Text>
    );
  });
}
