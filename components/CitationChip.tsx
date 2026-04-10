import { Pressable, Text, View } from 'react-native';
import { FileText } from 'lucide-react-native';
import type { FakeCitation } from '@/lib/fixtures';

interface CitationChipProps {
  citation: FakeCitation;
  index: number;
  onPress?: () => void;
}

export function CitationChip({ citation, index, onPress }: CitationChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className="mr-2 mb-2 flex-row items-center rounded-full border border-incense-300 bg-incense-50 px-3 py-1.5 active:bg-incense-100 dark:bg-nile-700 dark:border-incense-500"
    >
      <FileText size={12} color="#7A4B0B" />
      <Text className="ml-1.5 text-xs font-semibold text-incense-700 dark:text-incense-300">
        [{index + 1}]
      </Text>
      <Text
        className="ml-2 text-xs text-incense-700 dark:text-incense-300 max-w-[160px]"
        numberOfLines={1}
      >
        {citation.sourceTitle}
      </Text>
    </Pressable>
  );
}
