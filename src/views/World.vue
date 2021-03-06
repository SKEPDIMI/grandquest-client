<template>
  <div class="world-main">
    <div class="container">
      <!-- <header>
        <div class="stats" v-if="socket.loading">
          <h2>Connecting to the world <ActivityIndicator /></h2>
        </div>
        <div class="stats" v-else-if="socket.connected">
          <h2>GrandQuest World</h2>
          <p>Current time: {{ readableTimeOfDay }}</p>
          <p>Players Online: {{ world.connections }}</p>
        </div>
        <div class="stats" v-else>
          <h2>GrandQuest World</h2>
          <h3>You are currently offline</h3>
        </div>
      </header> -->
      
      <div class="s-control">
        <div class='control-head'>
            <img src="@/assets/img/icon/grandquest.png" />

            <p class="subtitle">Players currently online</p>
            <div class="player-showcase framed" v-if="socket.connected">
                <div class="player" v-for="user in world.connectedUsers" :key="user.id">
                    <img src="@/assets/img/icon/gq.png" class="thumbnail">
                    <div class="u-content">
                        <p class="title">{{user.username}}</p>
                        <p class="subtitle">joined {{sinceDate(user.createdAt)}}</p>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div id="world-content-hold">
        <div v-if="!user.authenticated" class="auth-banner">
          <h2 class="main-title">In order to browse GrandQuest you should sign in!</h2>
          <div class="auth">
            <h2>Are you new to GrandQuest?</h2>
            <router-link to='/signup'>Join for free!</router-link>
          </div>
        </div>
        <div class="content">
          <Games v-if="view==='games'"/>
          <Travel v-if="view==='travel'"/>
          <Leaderboards v-if="view==='leaderboards'"/>

          <div id="side-menu">
            <ul>
              <li v-on:click="setView('travel')" :class="view === 'travel' ? 'active' : ''">
                <img src="@/assets/img/icon/bag.png">Explore
              </li>
              <li v-on:click="setView('leaderboards')" :class="view === 'leaderboards' ? 'active' : ''">
                <img src="@/assets/img/icon/scroll.png">Leaderboards
              </li>
              <li v-on:click="setView('games')" :class="view === 'games' ? 'active' : ''">
                <img src="@/assets/img/icon/chest.png">Games
              </li>
              <li class="disabled">
                <img src="@/assets/img/icon/guild.png">Guild
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    <div v-if="socket.loading">
      <h2 class="subtitle">Connecting to the world <ActivityIndicator /></h2>
    </div>
    <div class="stats" v-else-if="socket.connected">
      <h3 class="subtitle">There are {{ currentlyOnline }} players currently online.</h3>
      </div>
  </div>
      
</template>
<script lang="ts">
import { Vue, Component } from 'vue-property-decorator';
import { State } from 'vuex-class';
import moment from 'moment';
import { World, SocketState, User } from '@/types';
import api from '@/api';
import ActivityIndicator from '@/components/ActivityIndicator.vue';
import Travel from '@/components/world/Travel.vue';
import Games from '@/components/world/Games.vue';
import Leaderboards from '@/components/world/Leaderboards.vue';
import { TweenLite, Elastic } from 'gsap';

@Component({
  components: {
    ActivityIndicator,
    Games,
    Travel,
    Leaderboards,
  },
})
export default class Main extends Vue {
  @State public socket!: SocketState;
  @State public world!: World;
  @State public user!: User;

  public view = 'travel';

  public mounted() {
    const { view } = this.$route.params;
    if (view === 'games' || view === 'travel') {
      this.view = view;
    } else {
      this.$router.replace('/world/travel');
      this.view = 'travel';
    }

    // fade in
    TweenLite.fromTo(document.getElementById('side-menu'), 1.5, { x: '150%' }, { x: '0%', ease: Elastic.easeOut.config(1, 0.5), });
    TweenLite.fromTo(document.getElementById('display'), 1, { opacity: 0 }, { opacity: 1 });
  }
  public setView(view: string) {
    if (this.view === view) {
      return;
    }
    // fade out
    TweenLite.fromTo(document.getElementById('side-menu'), 0.75, { x: '0%' }, { x: '150%', ease: Elastic.easeIn.config(0.5, 0.5), });
    TweenLite.fromTo(
      document.getElementById('display'),
      1,
      { opacity: 1 },
      { opacity: 0,
        onComplete: () => {
          this.view = view;
          this.$router.replace(`/world/${view}`);
          // fade in
          TweenLite.fromTo(document.getElementById('side-menu'), 1.5, { x: '150%' }, { x: '0%', ease: Elastic.easeOut.config(1, 0.5), });
          TweenLite.fromTo(document.getElementById('display'), 1, { opacity: 0 }, { opacity: 1 });
        }
      }
    );
  }
  public setGame(name: string) {
    this.$router.push(name);
  }
  get readableTimeOfDay() {
    return moment(this.world.timeOfDay).format('LT'); ;
  }
  get currentlyOnline() {
    return Object.keys(this.world.connectedUsers).length
  }
  public sinceDate(date: string) {
    return moment(date).fromNow();
  }
  get timeOfDay() {
    return moment(this.world.timeOfDay).format("ddd, MMM Do, ha");
  }
}
</script>

<style lang="scss">
  $mainBlue: #036ca5;
  $mainBlack: rgb(24, 24, 24);
  $mainGrey: rgb(179, 179, 179);
  $mainBlueHover: #005e91;
  $mainLightGrey: #e0e0e0;

  #world-content-hold {
    flex: 1;
    max-width: 1080px;
  }

  .s-control {        
    flex: 1;
    max-width: 340px;
    margin-right: 2em;
    color: $mainBlack;
    h2 {
        margin: .5em 0;
    }
    h3 {
        font-weight: lighter;
        color: $mainGrey;
    }
    .player-showcase {
        display: inline-flex;
        flex-direction: row;
        flex-wrap: nowrap;
        overflow-x: auto;
        width: 100%;
        // auto hide ugly ms scrollbar
        -ms-overflow-style: -ms-autohiding-scrollbar; 
        // smooth mobile scrolling
        -webkit-overflow-scrolling: touch;
        // hide scrollbar in webkit browsers
        &::-webkit-scrollbar { display: none; }
        .player {
            flex: 0 0 auto;
            padding: 1em 1em 1em 0;
            display: flex;
            flex-direction: row;
            .title {
                color: gold;
                margin: 0;
            }
            .subtitle {
                margin: 0;
            }
            .thumbnail {
                align-self: flex-start;
                width: 2.3em;
                border-radius: 1em;
                margin-right: 5px;
            }
        }
    }
    .control-head {
        background: $mainBlack;
        padding: 1em;
        border-radius: 10px;

        img {
            width: 200px;
        }
    }
  }
  .world-main {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 1em 2em;

    .auth-banner {
      width: 100%;
      padding: 2em;
      border-radius: 5px 5px 0 0;
      border-bottom: 5px solid #8a4f34;
      background-image: linear-gradient(to bottom, #bdedff 80%, #5bd0ff);
      color: #006e9c;
      text-align: center;
      font-size: small;
      .main-title {
        color: black;
        margin: 0;
      }
      a {
        box-shadow: inset 0px 1px 0px 0px #b8fff2;
        border-radius: .5rem;
        border: 1px solid #4355b0;
        font-size: 12px;
        font-weight: bold;
        padding: 14px 7px;
        text-shadow: 1px 1px 0px #154682;
        background-image: linear-gradient(to bottom, #6ebee7, #29489e);
        color: white;
        &:hover {
          background-image: linear-gradient(to top, #6ebee7, #29489e);
        }
      }
    }
    .container {
      width: 100%;
      color: white;
      overflow: hidden;
      border-radius: 5px;
      display: flex;
      flex-direction: row;

      .content {
        max-width: 1080px;
        flex: 1;
        background: black;
        overflow: hidden;
        padding: 10px;
        border-radius: 5px;
        // same height as #display (absolutely positioned child element)
        height: 500px;
        position: relative;
        display: flex;
        flex-direction: row;
        justify-content: flex-end;

        #side-menu {
          z-index: 10;
          float: right;
          font-family: 'Lora', serif;
          background-image: url('../assets/img/backgrounds/map-bg.png');
          background-blend-mode: darken;
          background-position: center;
          background-repeat: no-repeat;
          background-size: cover;
          border-radius: 2px;
          width: 30%;
          ul {
            list-style: none;
            margin: 0;
            padding: 0.5em 1em;
            li {
              position: relative;
              display: flex;
              flex-direction: row;
              align-items: center;
              color: rgb(236, 236, 236);
              font-size: x-large;
              font-weight: bold;
              padding: 10px;

              border-bottom: 1px solid #9f966a;
              text-shadow: 1px 1px rgb(73, 73, 73);
              cursor: pointer;
              &:hover {
                color: white;
              }
              &.active {
                color: white;
              }
              &.disabled {
                opacity: 0.6;
                cursor: default;
                &:after {
                  content: 'Coming Soon!';
                  font-size: small;
                  position: absolute;
                  top: 0;
                  right: 0;
                  background: rgb(27, 27, 27);
                  text-shadow: none;
                  border-radius: 2px;
                  padding: 2px;
                }
              }
              img {
                height: 2.5em;
              }
            }
            li:nth-last-child(1) {
              border: none;
            }
          }
        }

        /*
          Styles for display components
        */
        #display {
          // z-index: 5;
          // same height as .content (parent element)
          height: 500px;
          display: flex;
          flex-direction: column;
          padding: 0 35% 0 3em;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;

          .display-header {
            display: block;
            text-align: center;
            .display-title {
              margin: 1.75em 0;
              height: 4.20em;
            }
          }
          .body {
            flex: 1;
            display: flex;
            flex-direction: row;
            align-items: stretch;
            justify-content: center;
            padding-bottom: 2em;
            .panel {
              background: rgba(27, 27, 27, 0.9);
              padding: 10px 8px;
              border-radius: 2px;
              margin-right: 2em;
              flex: 2;
              section {
                border-bottom: 1px solid rgba(240, 240, 240, 0.8);
                .character {
                  display: flex;
                  flex-direction: row;
                  align-items: stretch;
                  padding: 10px 0;
                  .selection {
                    margin-right: 1em;
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    width: 100px;
                    .img-container {
                      text-align: center;
                      position: relative;
                      img {
                        width: 100px;
                        background: #0d1c2c;
                        border: 2px solid #454b40;
                      }
                      .cover {
                        padding: 5px;
                        text-align: center;
                        position: absolute;
                        top: 0;
                        bottom: 0;
                        width: inherit;
                        background: rgba(10, 10, 10, 0.8);
                        color: white;
                        margin: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                      }
                    }
                    .control {
                      display: flex;
                      flex-direction: row;
                      align-items: center;
                      justify-content: center;
                      height: 30px;
                      .chevron {
                        margin: 0;
                        height: 30px;
                        width: 30px;
                        border: none;
                        background-color: transparent;
                        background-image: url('../assets/img/icon/chevron.png');
                        background-size: contain;
                        background-repeat: no-repeat;
                        background-position: center center;
                        &.left {
                          transform: rotateZ(-90deg);
                        }
                        &.right {
                          transform: rotateZ(90deg);
                        }
                        &.disabled {
                          opacity: 0.6;
                          cursor: default;
                          &:hover {
                            opacity: 0.6;
                          }
                        }
                        &:hover {
                          opacity: 0.75;
                        }
                      }
                    }
                  }
                  .info {
                    flex: 1;
                    .row {
                      display: flex;
                      flex-direction: row;
                      align-items: center;
                      margin-bottom: 5px;
                      .col {
                        display: flex;
                        flex-direction: row;
                        align-items: center;
                        margin-right: 10px;

                        img {
                          height: 1.5em;
                          margin-right: 5px;
                        }
                      }
                    }
                  }
                }
                p {
                  margin: 0;
                }
              }
            }
            .buttons {
              display: flex;
              flex-direction: column;
              justify-content: center;
              .main-start {
                font-family: 'Lora', serif;
                font-size: larger;
                background: #d30938;
                color: white;
                font-weight: bold;
                border: none;
                box-shadow: 0px 0px 5px white;
                padding: 1em 1em;
                position: relative;
                transition: .2s all ease-in-out;
                &[disabled] {
                  background: grey;
                  opacity: 0.95;
                  cursor: default;
                  &:hover {
                    box-shadow: 0px 0px 5px white;
                  }
                }
                &:hover {
                  box-shadow: 0px 0px 10px white;
                }
                &.need-auth {
                  &::after {
                    content: 'Log in to play!';
                    font-size: small;
                    position: absolute;
                    top: -1em;
                    right: -1em;
                    background: #d30938;
                    text-shadow: none;
                    border-radius: 2px;
                    padding: 2px 5px;
                  }
                }
                &.need-health {
                  &::after {
                    content: 'Heal at the Potions Shop!';
                    font-size: small;
                    position: absolute;
                    top: -1em;
                    right: -1em;
                    background: #d30938;
                    text-shadow: none;
                    border-radius: 2px;
                    padding: 2px 5px;
                  }
                }
                &.socket-lock {
                  &::after {
                    content: 'You are currently in game!';
                    font-size: small;
                    position: absolute;
                    top: -1em;
                    right: -1em;
                    background: #d30938;
                    text-shadow: none;
                    border-radius: 2px;
                    padding: 2px 5px;
                  }
                }
              }
              .play-singleplayer {
                color: #ddc86c;
                background: transparent;
                border: none;
                font-size: large;
                &:hover {
                  color: #f0da77;
                }
              }
            }
          }
        }
      }
    }
  }
  @media screen and (max-width: 800px) {
    .container {
      #display {
        margin-top: 5em;
        width: 100%;
        position: static !important;
        padding: 0 3em !important;
      }
      #side-menu {
        float: none;
        display: block;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        width: 100% !important;
        display: flex !important;
        flex-direction: row;
        justify-content: space-around;
        align-items: center;
        ul {
          li {
            img {
              height: 2em !important;
            }
            border-bottom: none !important;
            display: inline-flex !important;
            font-size: medium !important;
          }
        }
      }
    }
  }
</style>
