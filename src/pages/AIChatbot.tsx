import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useChatbotRules } from '@/hooks/useChatbotRules';
import { useDevices } from '@/hooks/useDevices';
import { useAddOns } from '@/hooks/useAddOns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Bot, Plus, Trash2, Edit, Sparkles, Zap, MessageSquare, Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';

export default function AIChatbot() {
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  
  const { devices } = useDevices();
  const { rules, isLoading, createRule, updateRule, deleteRule, toggleActive } = useChatbotRules(selectedDevice);
  const { hasAddOn } = useAddOns();
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  const hasAIAddon = hasAddOn('ai-chatbot-basic') || hasAddOn('ai-chatbot-pro');
  const triggerType = watch('trigger_type', 'keyword');
  const responseType = watch('response_type', 'text');
  const aiEnabled = watch('ai_enabled', false);

  const onSubmit = async (data: any) => {
    try {
      if (editingRule) {
        await updateRule({ id: editingRule.id, ...data });
      } else {
        await createRule({ ...data, device_id: selectedDevice });
      }
      setIsDialogOpen(false);
      setEditingRule(null);
      reset();
    } catch (error) {
      console.error('Failed to save rule:', error);
    }
  };

  const handleEdit = (rule: any) => {
    setEditingRule(rule);
    Object.keys(rule).forEach(key => {
      setValue(key, rule[key]);
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus rule ini?')) {
      await deleteRule(id);
    }
  };

  if (!hasAIAddon) {
    return (
      <Layout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Lock className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">AI Chatbot Premium Feature</h2>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Fitur AI Chatbot memerlukan add-on premium. Upgrade sekarang untuk mendapatkan chatbot cerdas powered by AI!
            </p>
            <Button size="lg" asChild>
              <a href="/addons">Browse Add-ons</a>
            </Button>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">AI Chatbot Rules</h1>
            <p className="text-muted-foreground">
              Buat auto-reply cerdas dengan AI
            </p>
          </div>
          <Badge variant="default" className="gap-2">
            <Sparkles className="w-4 h-4" />
            AI Powered
          </Badge>
        </div>

        {/* Device Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Device</CardTitle>
            <CardDescription>Pilih device untuk manage chatbot rules</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a device..." />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.device_name} - {device.phone_number || 'No number'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedDevice && (
          <>
            {/* Add Rule Button */}
            <div className="flex justify-end">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingRule(null); reset(); }} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingRule ? 'Edit' : 'Create'} Chatbot Rule</DialogTitle>
                    <DialogDescription>Configure your AI-powered chatbot</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="rule_name">Rule Name *</Label>
                      <Input id="rule_name" {...register('rule_name', { required: true })} placeholder="e.g., Product Info" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="trigger_type">Trigger Type *</Label>
                        <Select {...register('trigger_type')} value={triggerType} onValueChange={(val) => setValue('trigger_type', val)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="keyword">Keyword</SelectItem>
                            <SelectItem value="ai">AI Detection</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Input id="priority" type="number" {...register('priority')} placeholder="0" defaultValue={0} />
                      </div>
                    </div>

                    {triggerType === 'keyword' && (
                      <div className="space-y-2">
                        <Label htmlFor="trigger_value">Keywords (comma separated)</Label>
                        <Input id="trigger_value" {...register('trigger_value')} placeholder="harga, price, info" />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="response_type">Response Type *</Label>
                      <Select {...register('response_type')} value={responseType} onValueChange={(val) => setValue('response_type', val)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Static Text</SelectItem>
                          <SelectItem value="ai">AI Generated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {responseType === 'text' && (
                      <div className="space-y-2">
                        <Label htmlFor="response_text">Response Text *</Label>
                        <Textarea id="response_text" {...register('response_text')} rows={4} placeholder="Your auto-reply message..." />
                      </div>
                    )}

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <Label htmlFor="ai_enabled" className="text-base">Enable AI Response</Label>
                        <p className="text-sm text-muted-foreground">Use AI untuk generate response</p>
                      </div>
                      <Switch id="ai_enabled" {...register('ai_enabled')} checked={aiEnabled} onCheckedChange={(val) => setValue('ai_enabled', val)} />
                    </div>

                    {aiEnabled && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="ai_model">AI Model</Label>
                          <Select {...register('ai_model')} defaultValue="google/gemini-2.5-flash">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="google/gemini-2.5-flash">Gemini Flash (Recommended)</SelectItem>
                              <SelectItem value="google/gemini-2.5-flash-lite">Gemini Lite (Faster)</SelectItem>
                              <SelectItem value="google/gemini-2.5-pro">Gemini Pro (Advanced)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="ai_prompt">AI System Prompt</Label>
                          <Textarea
                            id="ai_prompt"
                            {...register('ai_prompt')}
                            rows={4}
                            placeholder="You are a helpful customer service assistant. Be polite and concise..."
                          />
                          <p className="text-xs text-muted-foreground">Instruksi untuk AI tentang cara merespon</p>
                        </div>
                      </>
                    )}

                    <div className="flex gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingRule(null); reset(); }} className="flex-1">
                        Cancel
                      </Button>
                      <Button type="submit" className="flex-1">
                        {editingRule ? 'Update' : 'Create'} Rule
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Rules List */}
            {rules.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Bot className="w-16 h-16 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">Belum ada chatbot rules</p>
                  <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                    Buat rule pertama untuk mengaktifkan auto-reply AI
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {rules.map((rule) => (
                  <Card key={rule.id} className={rule.is_active ? 'border-primary/50' : 'opacity-60'}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg">{rule.rule_name}</CardTitle>
                            {rule.ai_enabled && (
                              <Badge variant="default" className="gap-1">
                                <Sparkles className="w-3 h-3" />
                                AI
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="flex items-center gap-2">
                            {rule.trigger_type === 'keyword' ? (
                              <>
                                <MessageSquare className="w-4 h-4" />
                                Keywords: {rule.trigger_value}
                              </>
                            ) : (
                              <>
                                <Zap className="w-4 h-4" />
                                AI Detection
                              </>
                            )}
                          </CardDescription>
                        </div>
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) => toggleActive({ id: rule.id, is_active: checked })}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Response Type:</span>{' '}
                        <Badge variant="outline">{rule.response_type}</Badge>
                      </div>
                      {rule.response_text && (
                        <div className="text-sm p-3 bg-muted rounded-lg">
                          <p className="line-clamp-2">{rule.response_text}</p>
                        </div>
                      )}
                      {rule.ai_enabled && rule.ai_prompt && (
                        <div className="text-sm p-3 bg-primary/5 rounded-lg border border-primary/10">
                          <p className="text-xs text-muted-foreground mb-1">AI Prompt:</p>
                          <p className="line-clamp-2">{rule.ai_prompt}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <span>Executed: {rule.execution_count} times</span>
                        <span>Priority: {rule.priority}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(rule)} className="flex-1 gap-2">
                          <Edit className="w-4 h-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleDelete(rule.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
