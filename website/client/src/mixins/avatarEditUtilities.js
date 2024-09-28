import axios from 'axios';

import unlock from '@/../../common/script/ops/unlock';
import buy from '@/../../common/script/ops/buy/buy';

import appearanceSets from '@/../../common/script/content/appearance/sets';
import appearances from '@/../../common/script/content/appearance';
import { getScheduleMatchingGroup } from '@/../../common/script/content/constants/schedule';

import { userStateMixin } from './userState';

export const avatarEditorUtilities = { // eslint-disable-line import/prefer-default-export
  mixins: [userStateMixin],
  data () {
    return {
      backgroundUpdate: new Date(),
    };
  },
  methods: {
    hideSet (setKey) {
      const matcher = getScheduleMatchingGroup('customizations');
      return !matcher.match(setKey);
    },
    mapKeysToFreeOption (key, type, subType) {
      const userPreference = subType
        ? this.user.preferences[type][subType]
        : this.user.preferences[type];
      const pathKey = subType ? `${type}.${subType}` : `${type}`;

      const option = {};
      option.key = key;
      option.pathKey = pathKey;
      option.active = userPreference === key;
      option.imageName = this.createImageName(type, subType, key);
      option.click = optionParam => (option.gemLocked ? this.unlock(`${optionParam.pathKey}.${key}`) : this.set({ [`preferences.${optionParam.pathKey}`]: optionParam.key }));
      option.text = subType ? appearances[type][subType][key].text()
        : appearances[type][key].text();

      return option;
    },
    mapKeysToOption (key, type, subType, set) {
      const option = this.mapKeysToFreeOption(key, type, subType);

      const userPurchased = subType
        ? this.user.purchased[type][subType]
        : this.user.purchased[type];
      const locked = !userPurchased || !userPurchased[key];
      let hide = false;

      if (set && appearanceSets[set] && locked) {
        hide = this.hideSet(set);
      }

      option.gemLocked = locked;
      option.hide = hide;
      if (locked) {
        option.gem = 2;
      }

      return option;
    },
    createImageName (type, subType, key) {
      let str = '';

      switch (type) {
        case 'shirt': {
          str += `${this.user.preferences.size}_shirt_${key}`;
          break;
        }
        case 'size': {
          str += `${key}_shirt_black`;
          break;
        }
        case 'hair': {
          if (subType === 'color') {
            str += `color_hair_bangs_${this.user.preferences.hair.bangs || 1}_${key}`;
          } else {
            str += `hair_${subType}_${key}_${this.user.preferences.hair.color}`;
          }
          break;
        }
        case 'skin': {
          str += `skin_${key}`;
          break;
        }
        default: {
          throw new Error(`unknown type ${type} ${subType} ${key}`);
        }
      }

      return str;
    },
    userOwnsSet (type, setKeys, subType) {
      let owns = true;

      setKeys.forEach(key => {
        if (subType) {
          if (
            !this.user.purchased[type]
            || !this.user.purchased[type][subType]
            || !this.user.purchased[type][subType][key]
          ) owns = false;
          return;
        }
        if (!this.user.purchased[type][key]) owns = false;
      });

      return owns;
    },
    set (settings) {
      this.$store.dispatch('user:set', settings);
    },
    equip (key, type) {
      this.$store.dispatch('common:equip', { key, type });
    },
    /**
     * For gem-unlockable preferences, (a) if owned, select preference (b) else, purchase
     * @param path: User.preferences <-> User.purchased maps like
     *User.preferences.skin=abc <-> User.purchased.skin.abc.
     *  Pass in this paramater as "skin.abc". Alternatively, pass as an
     * array ["skin.abc", "skin.xyz"] to unlock sets
     */
    async unlock (path) {
      await axios.post(`/api/v4/user/unlock?path=${path}`);
      try {
        unlock(this.user, {
          query: {
            path,
          },
        });
        this.backgroundUpdate = new Date();
        return true;
      } catch (e) {
        window.alert(e.message); // eslint-disable-line no-alert
        return false;
      }
    },
    async buy (item) {
      const options = {
        currency: 'gold',
        key: item,
        type: 'marketGear',
        quantity: 1,
        pinType: 'marketGear',
      };
      await axios.post(`/api/v4/user/buy/${item}`, options);
      try {
        buy(this.user, {
          params: options,
        });
        this.backgroundUpdate = new Date();
      } catch (e) {
        window.alert(e.message); // eslint-disable-line no-alert
      }
    },
  },
};
