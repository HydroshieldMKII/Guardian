import { parsePlexTvUsers } from '@/modules/users/services/plex-tv-users';

describe('parsePlexTvUsers', () => {
  it('reads every user element in the response', () => {
    expect(
      parsePlexTvUsers(`<MediaContainer>
        <User id="1" username="alice" thumb="a.png"/>
        <User id="2" username="bob" thumb="b.png"/>
      </MediaContainer>`),
    ).toEqual([
      { id: '1', username: 'alice', thumb: 'a.png' },
      { id: '2', username: 'bob', thumb: 'b.png' },
    ]);
  });

  it('falls back to the title for a username', () => {
    expect(parsePlexTvUsers('<User id="2" title="bob"/>')[0].username).toBe(
      'bob',
    );
  });

  it('falls back to the friendly name after the title', () => {
    expect(
      parsePlexTvUsers('<User id="3" friendlyName="carol"/>')[0].username,
    ).toBe('carol');
  });

  it('skips an empty username in favour of the title', () => {
    expect(
      parsePlexTvUsers('<User id="4" username="" title="dave"/>')[0].username,
    ).toBe('dave');
  });

  it('does not mistake a longer attribute for the id', () => {
    expect(
      parsePlexTvUsers('<User uuid="abc" id="5" username="erin"/>')[0].id,
    ).toBe('5');
  });

  it('leaves missing attributes undefined', () => {
    expect(parsePlexTvUsers('<User/>')).toEqual([
      { id: undefined, username: undefined, thumb: undefined },
    ]);
  });

  it('returns nothing when the response holds no users', () => {
    expect(parsePlexTvUsers('<MediaContainer/>')).toEqual([]);
  });
});
