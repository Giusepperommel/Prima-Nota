"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiKeyList } from "@/components/api-config/api-key-list";
import { WebhookList } from "@/components/api-config/webhook-list";

export function ApiConfigContent() {
  return (
    <Tabs defaultValue="keys">
      <TabsList>
        <TabsTrigger value="keys">Chiavi API</TabsTrigger>
        <TabsTrigger value="webhooks">Webhook</TabsTrigger>
      </TabsList>
      <TabsContent value="keys" className="mt-4">
        <ApiKeyList />
      </TabsContent>
      <TabsContent value="webhooks" className="mt-4">
        <WebhookList />
      </TabsContent>
    </Tabs>
  );
}
