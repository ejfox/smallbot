<template>
  <div class="container">
    <div class="chat">
      <div v-for="(msg, i) in messages" :key="i" :class="['message', msg.type]">
        <strong>{{ msg.type === 'user' ? 'You: ' : 'smallbot: ' }}</strong>
        <div v-html="msg.content.replace(/\n/g, '<br>')"></div>
      </div>
    </div>
    <div class="input-area">
      <textarea 
        v-model="input" 
        placeholder="Tell smallbot what kind of app to create..." 
        @keyup.ctrl.enter="sendMessage"
      ></textarea>
      <button @click="sendMessage" :disabled="isLoading">
        {{ isLoading ? 'Creating...' : 'Create' }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChatApp',
  data() {
    return {
      messages: [],
      input: '',
      isLoading: false
    }
  },
  methods: {
    async sendMessage() {
      if (!this.input.trim()) return;
      
      this.messages.push({ type: 'user', content: this.input });
      this.isLoading = true;
      
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: this.input })
        });
        
        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        this.messages.push({ type: 'bot', content: data.response });
      } catch (error) {
        this.messages.push({ 
          type: 'bot', 
          content: 'Error: ' + error.message + '\n\nPlease try again.'
        });
      } finally {
        this.isLoading = false;
        this.input = '';
      }
    }
  }
}
</script>

<style>
.container { 
  max-width: 800px; 
  margin: 0 auto; 
  padding: 2rem; 
}
.chat { 
  background: white; 
  border-radius: 8px; 
  padding: 1rem;
  height: 500px; 
  overflow-y: auto; 
  margin-bottom: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.input-area { 
  display: flex; 
  gap: 1rem; 
}
textarea {
  flex: 1; 
  padding: 0.5rem; 
  border-radius: 4px;
  border: 1px solid #ddd; 
  min-height: 80px;
}
button {
  padding: 0.5rem 1rem; 
  background: #0066ff;
  color: white; 
  border: none; 
  border-radius: 4px;
  cursor: pointer;
}
button:disabled { 
  background: #99c2ff; 
}
button:hover:not(:disabled) { 
  background: #0052cc; 
}
.message { 
  margin-bottom: 1rem; 
  padding: 0.5rem; 
  border-radius: 4px; 
}
.user { 
  background: #f0f0f0; 
}
.bot { 
  background: #f5f9ff; 
}
</style> 