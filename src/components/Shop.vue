<template>
  <div class="shop-main" ref="shop-main">
    <!-- Left-side panel -->
    <div class="npc-container">
      <div class="content">
        <img class="logo" :src="require(`../assets/img/icon/${shopName}.png`)" alt="Shop logo">
        <div id="npc-frame">
          <img :src="require(`../assets/img/icon/people/${npcName.toLowerCase()}.png`)" :alt="npcName">
          <div id="npc-name">
            {{npcName}}
          </div>
          <div id="npc-data">
            <button v-on:click="speak">
              Speak to {{npcName}}
            </button>
          </div>
          <div class="speech-bubble">
            Welcome, young traveller
          </div>
        </div>
      </div>
    </div>
    <!-- Selection Window -->
    <div class="GUI" :style="{ backgroundImage: `url(${require('../assets/img/backgrounds/' + shopName + '.png')})` }">
      <div class="user-control abs" v-if="!socket.connected">
        <h2>Offline</h2>
        <span>You don't appear to be connected to the server. You can not make any transactions unless you are online.</span>
      </div>
      <div class="user-control abs" v-else-if="!user.authenticated">
        <h2>Hmmm...</h2>
        <span>It doesn't look like you are logged in... Please log in order to make transactions!</span>
      </div>
      <!-- Sign container -->
      <div class="sign">
        <ul id="gui-selection-list">
          <li
            v-for="(option, index) in currentScreenObject"
            :key="option.title"
            :class="`${option.disabled ? 'disabled' : ''} ${currentCursorIndex == index ? 'active' : ''}`"
            v-on:mouseover="setCursorIndex(index)"
            v-on:click="selectOption"
          >
            {{ option.title }}
          </li>
        </ul>
      </div>
    </div>
    <div class="abs-stats">
      <!-- Power / Defense stats -->
      <div class="powdef-container framed" id="powdef">
        <div class="pow-container">
          <img src="@/assets/img/icon/1bit-swords.png" alt="Power: ">
          <span id="pow-label">0</span>
        </div>
        <div class="def-container">
          <img src="@/assets/img/icon/1bit-shield.png" alt="Defense: ">
          <span id="def-label">0</span>
        </div>
      </div>
      <!-- HP bar -->
      <div class="hp-container" id="hp">
        <header>
          <span>HP</span>
          <span id="hp-label"></span>
        </header>
        <div class="bar framed" id="hp-bar">
          <div class="juice" id="hp-juice"></div>
        </div>
      </div>
      <div id="gold-container">
        <img src="@/assets/img/items/coins.png" alt="Gold">{{user.gold.toLocaleString()}}
      </div>
    </div>
  </div> 
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop } from 'vue-property-decorator';
import { State, Mutation, Action } from 'vuex-class';
import { User, SocketState } from '@/types';
import AudioManager from '@/game/audio-manager';
import _ from 'underscore';
import { TimelineLite, TweenMax, Elastic } from 'gsap';
import audioManager from '@/game/audio-manager';
import api from '@/api';
import { ApiResponse } from 'apisauce';
import { powerDefenseCosts } from '@/game/definitions/costs';

@Component
export default class Shop extends Vue {
  @State public user!: User;
  @State public socket!: SocketState;
  @Action public SOCKET_EMIT!: any;
  @Mutation public SET_HEADER_VISIBILITY!: any;

  @Prop()
  public shopName!: string;
  @Prop()
  public exitShop!: () => void;
  // GUI state
  public moveCursorDelta: number = Date.now();
  public currentCursorIndex: number = 0;
  public currentScreen: string = 'root';

  public speechAnimationInterval: any = null;

  public combatData = {
    power: 1,
    defense: 1,
    loaded: -1, // -1 = err, 0 = pending, 1 = ok
  }

  public updated() {
    const { user, combatData } = this;

    // load combatData for user
    if (user.authenticated && combatData.loaded === -1) {
      this.combatData = { ...this.combatData, loaded: 0 };
      api.get(`combatant/${user.id}`)
      .then((res: ApiResponse<any>) => {
        const body = res.data;
        if (res.ok) {
          this.combatData = { ...body.data, loaded: 1 };
        } else {
          this.combatData = { ...this.combatData, loaded: -1 };
        }
      });
    }
  }
  get shops(): { [shopName: string]: any } {
    return {
      'monokai-village/potions-shop': {
        npcName: 'Even',
        npcSpeak: [
          'Sorry but our beauty potions probably wouldn\'t work on you.',
          'If you\'re looking for a love potion, I\'ve got bad news for you.',
          'Yes, I\'ve got the concoction you\'re looking for, just follow me into the cellar.',
          'I think some herbal tea would fix your stomach problems!',
          'We don\'t sell quackery, we sell magic!',
        ],
        guiMasterObject: {
          // screens
          'root': [
            // options
            { title: 'Buy', description: 'Buy from Even\'s potions', to: 'buy', disabled: false },
            { title: 'Sell', description: 'Sell potions from your own inventory', to: 'sell', disabled: false, select: null },
            {
              title: 'Heal',
              description: 'Heal your combat health to the maximum',
              to: null,
              disabled: false,
              select: () => {
                this.SOCKET_EMIT(['SHOP_TRANSACTION', { shop: 'potions-shop', action: 'heal' }, (err: any, results: { before: number, after: number, max: number, cost: number }) => {
                  if (err) {
                    audioManager.playOnce('cursorBack');
                    this.animateSpeech(err);
                  } else {
                    this.animateSpeech('That will leave a scar.');

                    const hpContainer = document.getElementById('hp');
                    const hpJuice = document.getElementById('hp-juice');
                    const hpLabel = document.getElementById('hp-label');
                    const goldContainer = document.getElementById('gold-container');
                    if (!hpContainer || !hpJuice || !hpLabel || !goldContainer) {
                      throw new Error('Missing HP elements to animate');
                    }
                    let target = { hp: results.before };

                    const tl = new TimelineLite();
                    // animate gold
                    const costText = document.createElement('span');
                    costText.innerHTML = `-${results.cost}`

                    goldContainer.appendChild(costText);
                    tl.add(
                      TweenMax.fromTo(
                        costText,
                        0.5,
                        { opacity: 0, y: -10 },
                        {
                          opacity: 1,
                          y: 10,
                          onStart() {
                            AudioManager.playOnce('goldDrop');
                          }
                        }
                      )
                    )
                    tl.to(
                      costText,
                      0.5,
                      {
                        opacity: 0,
                        y: 25,
                        delay: 1,
                        onComplete: () => {
                          costText.remove();

                          // animate hp bar into screen
                          TweenMax.fromTo(
                            hpContainer,
                            0.8,
                            { height: '0px', padding: 0, y: -100 },
                            {
                              height: 'auto',
                              padding: '1em',
                              y: 0,
                              ease: Elastic.easeOut.config(0.75, 0.5),
                            },
                          );
                        }
                      },
                    )
                    tl.to(
                      target,
                      0.5,
                      {
                        hp: results.after,
                        roundProps: 'hp',
                        onStart() {
                          audioManager.playOnce('heal');
                        },
                        onUpdate() {
                          hpJuice.style.width = `${target.hp / results.max * 100}%`;
                          hpLabel.innerHTML = `${target.hp}/${results.max}`;
                        },
                      }
                    )
                    tl.to(
                      hpContainer,
                      0.8,
                      { height: '0px', padding: 0, y: -100, delay: 2 },
                    );
                  }
                }]);
              }
            },
            { title: 'Exit',
              description: 'Back to the map',
              to: null,
              disabled: false,
              select: () => {
                this.animateSpeech('See you around, bozo.', () => setTimeout(() => {
                  const shopMainEl = document.querySelector('.shop-main');
                  if (!shopMainEl) {
                    return;
                  }
                  shopMainEl.classList.add('hide');
                  this.exitShop();
                }, 1500));
              },
            },
          ],
          'buy': [
            { title: 'Back', description: '', to: 'root', disabled: false, select: null },
            ..._.map({
                'heal-potion': { title: 'Health I', price: 8, description: 'Regenerates 25 health points when consumed' },
                'heal-potion-2': { title: 'Health II', price: 24, description: 'Regenerates 50 health points when consumed' },
                'energy-potion': { title: 'Energy I', price: 16, description: 'Recharges 15 energy points when consumed' },
              }, ({ title, description, price }, id) => ({
                title: `${title} - ${price} gold`,
                description,
                to: null,
                disabled: this.user && this.user.gold < price,
                select: () => {
                  this.SOCKET_EMIT(['SHOP_TRANSACTION', { shop: 'potions-shop', item: id }, (err: any) => {
                    if (err) {
                      audioManager.playOnce('cursorBack');
                      this.animateSpeech(err);
                    } else {
                      AudioManager.playOnce('goldDrop');

                      const replies = [
                        'Nice doing business',
                        'Enjoy,,',
                        'Good choice!',
                        'I\'m glad you like it',
                      ];

                      this.animateSpeech(replies[_.random(0, replies.length - 1)]);

                      const absEl = document.querySelector('.abs-stats');
                      const goldContainer = document.getElementById('gold-container');

                      if (!absEl || !goldContainer) {
                        throw new Error('Could not find abs-stats element');
                      }

                      const costText = document.createElement('span');
                      costText.innerHTML = `-${price}`

                      goldContainer.appendChild(costText);

                      TweenMax.fromTo(
                        costText,
                        0.5,
                        { opacity: 0, y: -20 },
                        {
                          opacity: 1,
                          y: 20,
                          onStart() {
                            AudioManager.playOnce('goldDrop');
                          },
                          onComplete() {
                            TweenMax.to(
                              costText,
                              0.5,
                              {
                                opacity: 0,
                                y: 25,
                                delay: 1,
                                onComplete() { costText.remove() }
                              },
                            );
                          },
                        },
                      );
                      /*
                      <div class="inventory-item">
                        <img class="logo" src="@/assets/img/items/heal-potion.png" alt="Heal Potion">
                        <div class="description">
                          <h1 class="title">Heal Potion I</h1>
                          <p>Heal Potion I was added to the inventory!</p>
                        </div>
                      </div>
                      */

                      // inventory frame
                      const invEl = document.createElement('div');
                      invEl.classList.add('inventory-item');

                      const invImgEl = document.createElement('img');
                      invImgEl.classList.add('icon');
                      invImgEl.setAttribute('src', require(`@/assets/img/items/${id}.png`));

                      const descEl = document.createElement('div');
                      descEl.classList.add('description');

                      const titleEl = document.createElement('h1');
                      titleEl.classList.add('title');
                      titleEl.innerHTML = `${title}`;
                      const pEl = document.createElement('p');
                      pEl.innerHTML = `${title} was added to the inventory!`;

                      descEl.appendChild(titleEl);
                      descEl.appendChild(pEl);

                      invEl.appendChild(invImgEl);
                      invEl.appendChild(descEl);

                      absEl.appendChild(invEl);

                      TweenMax.fromTo(
                        invEl,
                        0.5,
                        { x: 150 },
                        { x: 0,
                          ease: Elastic.easeOut.config(0.75, 0.5),
                          onComplete() {
                            TweenMax.to(
                              invEl,
                              0.5,
                              {
                                x: '100%',
                                delay: 2,
                                onComplete() { invEl.remove() }
                              },
                            );
                          }
                        },
                      );
                    }
                  }]);
                },
              })
            )
          ],
          'sell': [
            { title: 'Back', description: '', to: 'root', disabled: false, select: null },
          ]
        }
      },
      'monokai-village/village-gate': {
        npcName: 'Daelen',
        npcSpeak: [
          'I used to be an adventurer like you.',
          'Are you sure you\'re supposed to be wandering the village all by yourself?',
          'Careful, adventurer! There are fierce creatures outside the safe closures of Monokai.',
          'I had another one of you vagabonds come talk to me earlier about some slimes!',
          'How\'s the view from up here, traveller?',
        ],
        guiMasterObject: {
          // screens
          'root': [
            // options
            { 
              title: 'Order Caravan',
              description: 'Send a caravan on an expedition for treasure',
              select: () => {
                this.animateSpeech('Sorry, but the caravans are temporarily busy traveling other lands.')
              }
            },
            { title: 'Exit',
              description: 'Back to the map',
              to: null,
              disabled: false,
              select: () => {
                this.animateSpeech('Stay safe!', () => setTimeout(() => {
                  const shopMainEl = document.querySelector('.shop-main');
                  if (!shopMainEl) {
                    return;
                  }
                  shopMainEl.classList.add('hide');
                  this.exitShop();
                }, 1500));
              },
            },
          ],
          'caravan': [
            { title: 'Back', description: '', to: 'root', disabled: false, select: null },
          ],
        }
      },
      'monokai-village/combat-shop': {
        npcName: 'Marco',
        npcSpeak: [
          'Welcome to `El Combatánte!`',
          'Is it strength you seek? I\'ve got quite the bribe for you, my friend.',
          'It\'s dangerous to go out alone... Get yourself in fighting shape!',
        ],
        guiMasterObject: {
          // screens
          'root': [
            // options
            { title: 'Upgrades', description: 'Upgrade your combat stats!', to: 'upgrade', disabled: false },
            { title: 'Heal', description: 'Heal your character', to: null, disabled: true },
            { title: 'Exit',
              description: 'Back to the map',
              to: null,
              disabled: false,
              select: () => {
                this.animateSpeech('Until next time, traveller', () => setTimeout(() => {
                  const shopMainEl = document.querySelector('.shop-main');
                  if (!shopMainEl) {
                    return;
                  }
                  shopMainEl.classList.add('hide');
                  this.exitShop();
                }, 1500));
              },
            },
          ],
          'upgrade': [
            { title: 'Back', description: '', to: 'root', disabled: false, select: null },
            {
              title: `Upgrade Power ${this.combatData.loaded === 1 ? `(${powerDefenseCosts[this.combatData.power + 1] || '???'} gold)` : ''}`,
              description: `
                Upgrade your combat power ${
                  this.combatData.loaded === 1 ?
                    `to level ${this.combatData.power + 1}`
                    : ''
                }
                `,
              to: null,
              disabled: this.combatData.loaded !== 1 || (this.user && this.user.gold < powerDefenseCosts[this.combatData.power + 1]),
              select: () => {
                this.SOCKET_EMIT(['SHOP_TRANSACTION', { shop: 'combat-shop', action: 'power-up' }, (err: any, results: { before: number, after: number, cost: number }) => {
                  if (err) {
                    audioManager.playOnce('cursorBack');
                    this.animateSpeech(err);
                  } else {
                    this.combatData.power = results.after;

                    this.animateSpeech('You\'re all set');

                    const powdefContainer = document.getElementById('powdef');
                    const powLabel = document.getElementById('pow-label');
                    const defLabel = document.getElementById('def-label');
                    const goldContainer = document.getElementById('gold-container');
                    if (!goldContainer || !powdefContainer || !powLabel || !defLabel) {
                      throw new Error('Missing elements to animate');
                    }

                    const tl = new TimelineLite();
                    // animate gold
                    const costText = document.createElement('span');
                    costText.innerHTML = `-${results.cost}`

                    goldContainer.appendChild(costText);
                    tl.add(
                      TweenMax.fromTo(
                        costText,
                        0.5,
                        { opacity: 0, y: -10 },
                        {
                          opacity: 1,
                          y: 10,
                          onStart() {
                            AudioManager.playOnce('goldDrop');
                          }
                        }
                      )
                    )
                    tl.to(
                      costText,
                      0.5,
                      {
                        opacity: 0,
                        y: 25,
                        delay: 1,
                        onComplete: () => {
                          costText.remove();
                        }
                      },
                    );
                    tl.add(
                      TweenMax.fromTo(
                        powdefContainer,
                        0.8,
                        { height: '0px', padding: 0, y: -100 },
                        {
                          height: 'auto',
                          padding: '1em',
                          y: 0,
                          ease: Elastic.easeOut.config(0.75, 0.5),
                          onStart: () => {
                            powLabel.innerHTML = String(results.before);
                            defLabel.innerHTML = String(this.combatData.defense);
                            setTimeout(() => {
                              AudioManager.playOnce('xpGain');
                              powLabel.innerHTML = String(results.after);
                            }, 750);
                          },
                        }
                      )
                    );
                    tl.to(
                      powdefContainer,
                      0.8,
                      { height: 0, padding: 0, y: -100, delay: 2.25 },
                    )
                  }
                }]);
              }
            },
            {
              title: `Upgrade Defense ${this.combatData.loaded === 1 ? `(${powerDefenseCosts[this.combatData.defense + 1] || '???'} gold)` : ''}`,
              description: `
                Upgrade your combat defense ${
                  this.combatData.loaded === 1 ?
                    `to level ${this.combatData.defense + 1}`
                    : ''
                }
                `,
              to: null,
              disabled: this.combatData.loaded !== 1 || (this.user && this.user.gold < powerDefenseCosts[this.combatData.defense + 1]),
              select: () => {
                this.SOCKET_EMIT(['SHOP_TRANSACTION', { shop: 'combat-shop', action: 'defense-up' }, (err: any, results: { before: number, after: number, cost: number }) => {
                  if (err) {
                    audioManager.playOnce('cursorBack');
                    this.animateSpeech(err);
                  } else {
                    this.combatData.defense = results.after;

                    this.animateSpeech('You\'re all set!');

                    const powdefContainer = document.getElementById('powdef');
                    const powLabel = document.getElementById('pow-label');
                    const defLabel = document.getElementById('def-label');
                    const goldContainer = document.getElementById('gold-container');
                    if (!goldContainer || !powdefContainer || !powLabel || !defLabel) {
                      throw new Error('Missing elements to animate');
                    }

                    const tl = new TimelineLite();
                    // animate gold
                    const costText = document.createElement('span');
                    costText.innerHTML = `-${results.cost}`

                    goldContainer.appendChild(costText);
                    tl.add(
                      TweenMax.fromTo(
                        costText,
                        0.5,
                        { opacity: 0, y: -10 },
                        {
                          opacity: 1,
                          y: 10,
                          onStart() {
                            AudioManager.playOnce('goldDrop');
                          }
                        }
                      )
                    )
                    tl.to(
                      costText,
                      0.5,
                      {
                        opacity: 0,
                        y: 25,
                        delay: 1,
                        onComplete: () => {
                          costText.remove();
                        }
                      },
                    );
                    tl.add(
                      TweenMax.fromTo(
                        powdefContainer,
                        0.8,
                        { height: '0px', padding: 0, y: -100 },
                        {
                          height: 'auto',
                          padding: '1em',
                          y: 0,
                          ease: Elastic.easeOut.config(0.75, 0.5),
                          onStart: () => {
                            defLabel.innerHTML = String(results.before);
                            powLabel.innerHTML = String(this.combatData.power);
                            setTimeout(() => {
                              AudioManager.playOnce('xpGain');
                              defLabel.innerHTML = String(results.after);
                            }, 750);
                          },
                        }
                      )
                    );
                    tl.to(
                      powdefContainer,
                      0.8,
                      { height: 0, padding: 0, y: -100, delay: 2.25 },
                    );
                  };
                }]);
              }
            },
          ],
        }
      }
    }
  }

  public mounted() {
    if (!this.shops.hasOwnProperty(this.shopName)) {
      throw new Error('Unknown shop name passed to Shop.vue: ' + this.shopName);
    }
    this.animateSpeech('Welcome young traveller. What do you seek?');

    document.addEventListener('keydown', this.keyMonitor, true);
  }
  public keyMonitor(event: any) {
    event.preventDefault();
    if (Date.now() - this.moveCursorDelta <= 100) {
      return
    }
    if (!this.user.authenticated || !this.socket.connected) {
      return
    }
    this.moveCursorDelta = Date.now();
    switch (event.key.toUpperCase()) {
      case 'W':
        this.moveCursor('up');
        break;
      case 'A':
        this.moveCursor('left');
        break;
      case 'S':
        this.moveCursor('down');
        break;
      case 'D':
        this.moveCursor('right');
        break;
      case 'ENTER':
        this.selectOption();
        break;
    }
  }
  public destroyed() {
    document.removeEventListener('keydown', this.keyMonitor, true);
  }
  public animateSpeech(speech: string, cb?: () => void) {
    const speechBubble = document.querySelector('.speech-bubble');
    if (!speechBubble) {
      return;
    }
    const bubbleScaling = TweenMax.fromTo(speechBubble, 1, { scale: 1 }, { scale: 1.1, repeat: -1, yoyo: true });
    while (speechBubble.firstChild) {
      speechBubble.removeChild(speechBubble.firstChild);
    }

    const id = `${speech.trim().toLowerCase()}${Date.now()}`;
    const a = speech.split('');

    if (this.speechAnimationInterval === id) return;
    this.speechAnimationInterval = id;

    a.forEach((s, i) => {
      setTimeout(() => {
        if (this.speechAnimationInterval === id) {
          const charEl = document.createElement('span');
          charEl.innerHTML = s;
          speechBubble.appendChild(charEl);
          charEl.classList.add('fade-in');
          if (s !== ' ' && s !== '.' && Math.random() <= 0.5) {
            audioManager.playOnce('npcBubble');
          }
          if (i === a.length - 1) {
            this.speechAnimationInterval = '';
            bubbleScaling.kill();
            if (typeof cb === 'function') {
              cb();
            }
          }
        }
      }, 35 * (i + 1));
    });
  }
  public speak() {
    const randomSpeech = this.currentShop.npcSpeak[Math.floor(Math.random() * this.currentShop.npcSpeak.length)];
    this.animateSpeech(randomSpeech)
  }
  public selectOption() {
    let option = this.currentScreenObject[this.currentCursorIndex];

    if (option.disabled) {
      return;
    }

    if (typeof option.select === 'function') {
      option.select();
    } else if (option.to) {
      this.currentScreen = option.to;
      this.currentCursorIndex = 0;
    }
  }
  public setCursorIndex(index: number) {
    if (this.currentCursorIndex !== index) {
      this.currentCursorIndex = index;
      AudioManager.playOnce('cursorMove');
    }
  }
  public moveCursor(direction: string) {
    const options = this.currentScreenObject;
    const currentIndex = this.currentCursorIndex;
    let nextIndex = currentIndex;
    let j = currentIndex;

    // Move the cursor index
    if (direction === 'up') {
      if (currentIndex > 0) {
        j--;
      } else {
        j = options.length - 1;
      }
    } else if (direction === 'down') {
      if (currentIndex < options.length - 1) {
        j++;
      } else {
        j = 0;
      }
    } else {
      return;
    }
    this.setCursorIndex(j);
  }
  @Watch('user')
  onChildChanged(cur: User, prev: User) {
    if (cur.gold !== prev.gold && (prev.gold === 0 && cur.gold !== 0)) {
      AudioManager.playOnce('goldDrop');
    }
  }
  get currentShop() {
    return this.shops[this.shopName];
  }
  get npcName() {
    if (!this.currentShop) return 'Daelen'; // default npc

    const npcName = this.currentShop.npcName;
    return npcName.charAt(0).toUpperCase() + npcName.substr(1);
  }
  get currentScreenObject() {
    return this.currentShop.guiMasterObject[this.currentScreen];
  }
}
</script>
<style lang="scss">
.shop-main {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  height: 100vh;
  overflow: hidden;
  opacity: 0;
  z-index: 15;
  animation-name: fade-in;
  animation-duration: .5s;
  animation-play-state: running;
  animation-fill-mode: forwards;

  &.hide {
    animation-name: fade-out;
  }
  
  .npc-container {
    background: #e6e6e6;
    .logo {
      margin: 1em 0;
      width: 275px;
    }
    .content {
      padding: 0 20px;
      h1 {
        margin: 10px 0 0 0;
        text-transform: capitalize;
      }
      #npc-frame {
        margin: 0 auto;
        width: 210px;
        img {
          width: inherit;
          user-select: none;
        }
        #npc-name {
          background: #3b63bb;
          color: white;
          padding: 5px;
          text-align: center;
        }
        #npc-data {
          display: flex;
          flex-direction: column;
          align-items: stretch;

          background: #1d2560;
          padding: 10px 15px;

          button {
            background: linear-gradient(to bottom, white, rgb(202, 202, 202));
            border: none;
            padding: 5px 10px;
            font-weight: bold;
            color: #3b63bb;
            &:hover {
              background: linear-gradient(to bottom, white, rgb(177, 177, 177));
            }
          }
        }
        .speech-bubble {
          font-family: 'Courier New', Courier, monospace;
          background: white;
          font-weight: bold;
          position: relative; border-radius: .4em;
          padding: 15px;
          margin-top: 10px;
        }
        .speech-bubble:after {
          content: '';
          position: absolute; 
          top: 0; 
          left: 85%;
          width: 0;
          height: 0;
          border: 1.375em solid transparent;
          border-bottom-color: #fffcf7; 
          border-top: 0;
          border-left: 0;
          margin-left: -0.687em;
          margin-top: -1.375em;
        }
      }
    }
  }
  .GUI {
    flex: 1;
    position: relative;
    background-repeat: no-repeat;
    background-size: cover;
    background-position: center;
    height: 100% !important;
    font-size: large;

    .sign {
      background: #000 url('../assets/img/textures/dark-noise.png');
      border: 5px solid transparent;
      border-image: url('../assets/img/textures/frame-border.png');
      border-image-outset: 0;
      border-image-repeat: round;
      border-image-slice: 3;
      border-radius: 2px;
      margin-top:2em;
      margin-left: auto;
      margin-right: auto;
      max-height: 50%;
      max-width: 60%;
      &::before {
        content: '|';
        font-size: large;
        position: absolute;
        top: 0;
        left: 25%;
        background: white;
        height: 2.5em;
      }
      &::after {
        content: '|';
        font-size: large;
        position: absolute;
        top: 0;
        right: 25%;
        background: white;
        height: 2.5em;
      }
    }

    .user-control {
      position: absolute;
      top: 10px;
      right: 10px;
      background-color: rgb(43, 43, 43);
      h2 {
        margin-top: 0;
        font-size: medium;
      }
      small, img {
        display: none;
      }
      &.abs {
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        margin: 5em 1em;
        max-width: 1020px;
        max-height: 45vh;
        display: block;
      }
    }
  }
  .abs-stats {
    position: absolute;
    top: 1em;
    right: 1em;
    .powdef-container {
      overflow: hidden;
      padding: 0;
      transform: translateY(-100px);
      height: 0;

      display: flex;
      flex-direction: row;
      align-items: center;
      color: white;
      .pow-container, .def-container {
        flex: 1;
        display: flex;
        flex-direction: row;
        align-items: center;
        margin-right: 1em;
        img {
          height: 2em;
          margin-right: 10px;
        }
        span {
          font-size: 1.5em;
        }
      }
    }
    .inventory-item {
      overflow: hidden;
      color: white;
      padding: 6px 8px;
      background: #000 url('../assets/img/textures/dark-noise.png');
      border: 3px solid transparent;
      border-image: url('../assets/img/textures/frame-border.png');
      border-image-outset: 0;
      border-image-repeat: round;
      border-image-slice: 3;
      border-radius: 2px;
      box-shadow: 0px 0px 1px 2px rgba(0,0,0,0.5),0px 2px 4px rgba(0,0,0,0.25),0px 0px 6px 1px rgba(0,0,0,0.5) inset;
      display: flex;
      flex-direction: row;
      .icon {
        height: 2em;
        margin-right: 1em;
        align-self: center;
      }
      .description {
        align-self: stretch;
        .title {
          font-size: large;
          margin: 0;
        }
      }
    }
    .hp-container {
      overflow: hidden;
      padding: 0;
      transform: translateY(-100px);
      height: 0;
      color: white;
      background: rgba(0,0,0,0.75);
      border-radius: 2px;
      min-width: 200px;
    }
    #gold-container {
      padding: 5px;
      border-radius: 5px;
      background: rgba(0, 0, 0, 0.8);
      color: #d6ce59;
      display: flex;
      flex-direction: row;
      align-items: center;
      img {
        height: 1em;
        margin-right: 0.5em;
      }
    }
  }

  span.fade-in {
    animation: fade-in;
    animation-duration: 0.25s;
  }

  @keyframes fade-in {
    from {
      transform: translateY(-8px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  @keyframes fade-out {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
}
</style>

