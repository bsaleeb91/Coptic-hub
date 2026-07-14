import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { MessageBubble } from './MessageBubble';
import { CitationSheet } from './CitationSheet';
import { Input } from './Input';
import { Button } from './Button';
import type { FakeCitation, FakeMessage } from '@/lib/fixtures';

interface ChatViewProps {
  messages: FakeMessage[];
  placeholder?: string;
  emptyHint?: string;
}

/**
 * Shared chat UI used by all chat-style agents. In commit 2 this will take an
 * `onSend` prop that streams to the claude-proxy Edge Function. For now the
 * input is non-functional — it's here so you can feel the layout.
 */
export function ChatView({
  messages,
  placeholder = 'Ask a question...',
  emptyHint,
}: ChatViewProps) {
  const [activeCitation, setActiveCitation] = useState<FakeCitation | null>(null);
  const [draft, setDraft] = useState('');

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="py-2"
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && emptyHint ? (
          <Text className="mt-10 text-center text-base italic text-parchment-700 dark:text-parchment-400">
            {emptyHint}
          </Text>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onCitationPress={(c) => setActiveCitation(c)}
            />
          ))
        )}
      </ScrollView>

      <View className="flex-row items-end gap-2 pt-3 border-t border-parchment-200 dark:border-nile-700">
        <View className="flex-1">
          <Input
            placeholder={placeholder}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
        </View>
        <Button
          variant="primary"
          onPress={() => {
            // Intentionally no-op in commit 1 — wired up in commit 2.
            setDraft('');
          }}
        >
          Send
        </Button>
      </View>

      <CitationSheet
        citation={activeCitation}
        visible={!!activeCitation}
        onClose={() => setActiveCitation(null)}
      />
    </View>
  );
}
