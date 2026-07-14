import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { X, FileText } from 'lucide-react-native';
import type { FakeCitation } from '@/lib/fixtures';

interface CitationSheetProps {
  citation: FakeCitation | null;
  visible: boolean;
  onClose: () => void;
}

export function CitationSheet({ citation, visible, onClose }: CitationSheetProps) {
  if (!citation) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-nile-900/60" onPress={onClose}>
        <View className="flex-1" />
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View className="rounded-t-3xl bg-parchment-50 dark:bg-nile-800 px-5 pt-5 pb-10 max-h-[70%]">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View className="rounded-full bg-incense-100 dark:bg-nile-700 p-2 mr-3">
                  <FileText size={18} color="#7A4B0B" />
                </View>
                <Text className="text-xs font-semibold uppercase tracking-wider text-parchment-700 dark:text-parchment-300">
                  Citation
                </Text>
              </View>
              <Pressable onPress={onClose} className="p-1">
                <X size={20} color="#5F4F30" />
              </Pressable>
            </View>

            <Text className="text-lg font-semibold text-nile-900 dark:text-parchment-100">
              {citation.sourceTitle}
            </Text>
            <Text className="mt-1 text-sm text-parchment-700 dark:text-parchment-400">
              {citation.pageStart === citation.pageEnd
                ? `Page ${citation.pageStart}`
                : `Pages ${citation.pageStart}–${citation.pageEnd}`}
            </Text>

            <ScrollView className="mt-5 max-h-80">
              <View className="rounded-xl2 border-l-4 border-incense-500 bg-parchment-100 dark:bg-nile-900 px-4 py-3">
                <Text className="text-[15px] leading-relaxed text-nile-900 dark:text-parchment-100 italic">
                  {citation.excerpt}
                </Text>
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
