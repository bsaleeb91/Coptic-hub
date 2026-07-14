import { View, Text, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { CheckSquare, Square, Calendar } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { PROJECTS, type FakeProject } from '@/lib/fixtures';

export default function SundaySchool() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Sunday School' }} />

      <View className="mt-2 mb-4">
        <Text className="text-2xl font-bold text-nile-900 dark:text-parchment-100">
          Projects
        </Text>
        <Text className="mt-1 text-sm text-parchment-700 dark:text-parchment-400">
          Plans, tasks, and reminders for your class.
        </Text>
      </View>

      <View className="gap-4">
        {PROJECTS.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </View>

      <View className="mt-6">
        <Button variant="primary" fullWidth>
          + New project
        </Button>
      </View>
    </Screen>
  );
}

function ProjectCard({ project }: { project: FakeProject }) {
  const done = project.tasks.filter((t) => t.done).length;
  const total = project.tasks.length;
  const pct = total === 0 ? 0 : (done / total) * 100;

  const statusMeta = {
    planning: { label: 'Planning', bg: 'bg-parchment-200 dark:bg-nile-700', text: 'text-nile-800 dark:text-parchment-200' },
    'in-progress': { label: 'In progress', bg: 'bg-incense-100 dark:bg-incense-700/30', text: 'text-incense-700 dark:text-incense-300' },
    done: { label: 'Done', bg: 'bg-olive-500/20', text: 'text-olive-600' },
  }[project.status];

  return (
    <View className="rounded-xl2 bg-parchment-50 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700 p-4">
      <View className="flex-row items-start">
        <View className="flex-1">
          <Text className="text-base font-semibold text-nile-900 dark:text-parchment-100">
            {project.title}
          </Text>
          <View className="mt-1 flex-row items-center">
            <Calendar size={12} color="#8C7548" />
            <Text className="ml-1 text-xs text-parchment-700 dark:text-parchment-400">
              Due {project.dueDate}
            </Text>
          </View>
        </View>
        <View className={`rounded-full ${statusMeta.bg} px-2.5 py-1`}>
          <Text className={`text-[10px] font-bold uppercase ${statusMeta.text}`}>
            {statusMeta.label}
          </Text>
        </View>
      </View>

      <View className="mt-3 h-1.5 rounded-full bg-parchment-200 dark:bg-nile-700 overflow-hidden">
        <View className="h-full rounded-full bg-olive-500" style={{ width: `${pct}%` }} />
      </View>
      <Text className="mt-1 text-[11px] text-parchment-700 dark:text-parchment-400">
        {done} of {total} tasks complete
      </Text>

      <View className="mt-4 gap-2">
        {project.tasks.map((task, i) => (
          <Pressable key={i} className="flex-row items-center">
            {task.done ? (
              <CheckSquare size={18} color="#6B8E23" />
            ) : (
              <Square size={18} color="#8C7548" />
            )}
            <Text
              className={`ml-2 text-sm ${
                task.done
                  ? 'text-parchment-600 dark:text-parchment-500 line-through'
                  : 'text-nile-900 dark:text-parchment-100'
              }`}
            >
              {task.title}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
