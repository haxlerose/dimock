/*
 * The season is written down once, in events.html, and nowhere else. This
 * script reads the dates back out of those cards so the events page can put
 * what is still to come first, and so the homepage band can name the next
 * service without anybody editing it every week.
 *
 * Everything here is an enhancement. With this file missing, blocked, or
 * broken, the events page still lists every service in document order and the
 * homepage still says "Sunday evening services at 6:00 pm" — which is true on
 * any date. Nothing is ever hidden; past services are dimmed, not removed.
 *
 * Every fact is read off the card the visitor is already reading: the day line
 * gives the date, the heading gives the title, and data-season on the wrapper
 * gives the year. Nothing here needs the schedule spelled out a second time in
 * an attribute nobody proofreads.
 */
(function () {
  'use strict';

  var MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  var DAYS = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday',
    'Thursday', 'Friday', 'Saturday'
  ];

  /* Builds a local-midnight date from its parts, which is what a date on a
     poster means. An ISO string handed to Date.parse is read as UTC and lands
     on the previous day everywhere in the United States.

     The round trip rejects "Feb 31" and friends, which JavaScript would
     otherwise roll forward into March rather than treat as the typo it is. */
  function localDate(year, month, day) {
    var date = new Date(year, month, day);
    if (isNaN(date.getTime())) return null;
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      return null;
    }
    return date;
  }

  /* Reads the one line the owner actually writes: an optional weekday word,
     a month, and a day. "Sat, Jul 11", "Saturday, July 11", "Sat · Jul 11" and
     "Sat Jul 11" all mean the same thing and all parse. A month is matched by
     case-insensitive prefix of three characters or more, which is unambiguous
     across all twelve names.

     The weekday word is deliberately not used: it is redundant, and the check
     harness is what makes the redundancy pay by failing when the word and the
     date disagree. Returns null on anything it cannot read. */
  function parseEventDay(text, seasonYear) {
    var normalized = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    var parts = /^(?:[A-Za-z]{2,9}\.?[,·\s]+)?([A-Za-z]{3,9})\.?[,·\s]+(\d{1,2})\b/
      .exec(normalized);
    if (!parts) return null;

    var wanted = parts[1].toLowerCase();
    var month = -1;
    for (var i = 0; i < MONTHS.length; i += 1) {
      if (MONTHS[i].toLowerCase().indexOf(wanted) === 0) { month = i; break; }
    }
    if (month < 0) return null;

    return localDate(seasonYear, month, Number(parts[2]));
  }

  /* Returns {date, title, element} for every readable card, earliest first.
     A card whose day line cannot be read is left out of the ordering rather
     than guessed at — it stays on the page exactly where the author put it,
     untinted and unsorted, with its text intact.

     The year is the one thing a card does not carry, so it comes from
     data-season on the wrapper: written once for the whole season, and the
     only thing on the page that knows what year it is. Without it there is
     nothing to build a date from, and doing nothing is the right answer. */
  function readEvents(root) {
    var list = root.querySelector
      ? (root.matches && root.matches('[data-schedule="events"]')
          ? root
          : root.querySelector('[data-schedule="events"]'))
      : null;
    if (!list) return [];

    var declared = (list.getAttribute('data-season') || '').trim();
    if (!/^\d{4}$/.test(declared)) return [];
    var seasonYear = Number(declared);

    var events = [];
    Array.prototype.forEach.call(
      list.querySelectorAll('.event-card'),
      function (element) {
        var day = element.querySelector('.event-day');
        var title = element.querySelector('.event-title');
        var date = day ? parseEventDay(day.textContent, seasonYear) : null;
        if (!date) return;
        events.push({
          date: date,
          title: title ? title.textContent.replace(/\s+/g, ' ').trim() : '',
          element: element
        });
      }
    );
    events.sort(function (a, b) { return a.date - b.date; });
    return events;
  }

  /* Tint is decoration and script may own it; the day is spelled out in the
     markup and never is. Anything that is neither a Saturday nor a Sunday
     simply keeps the neutral rule it was served with. */
  function tint(event) {
    var day = event.date.getDay();
    if (day === 0) event.element.classList.add('event-card-sunday');
    else if (day === 6) event.element.classList.add('event-card-saturday');
  }

  /* An event belongs to the whole of its own day: tonight's service is still
     upcoming at eleven o'clock tonight, and only becomes past tomorrow. */
  function partition(events, today) {
    var cutoff = new Date(
      today.getFullYear(), today.getMonth(), today.getDate()
    ).getTime();
    var past = [];
    var upcoming = [];
    events.forEach(function (event) {
      if (event.date.getTime() < cutoff) past.push(event);
      else upcoming.push(event);
    });
    return { past: past, upcoming: upcoming };
  }

  function formatDate(date) {
    return DAYS[date.getDay()] + ', ' + MONTHS[date.getMonth()] + ' ' + date.getDate();
  }

  function groupHeading(text) {
    var heading = document.createElement('h2');
    heading.className = 'schedule-group';
    heading.textContent = text;
    return heading;
  }

  /* The flag is words, not a tint. Strip every colour from the page and it
     still says which service is the next one. */
  function flagAsNext(element) {
    element.classList.add('is-next');
    var flag = document.createElement('p');
    flag.className = 'event-flag';
    flag.textContent = 'Next service';
    element.insertBefore(flag, element.firstChild);
  }

  function orderEventsPage() {
    var list = document.querySelector('[data-schedule="events"]');
    if (!list) return;

    var events = readEvents(list);
    if (events.length === 0) return;

    var split = partition(events, new Date());
    var ordered = document.createDocumentFragment();

    /* Nine past services with nothing said about them read as a season still
       to come. Say so instead — and take the year from the same attribute
       everything else does, so this never needs hand-editing either. */
    if (split.upcoming.length === 0 && split.past.length > 0) {
      var note = document.createElement('p');
      note.className = 'schedule-note';
      note.textContent =
        'The ' + list.getAttribute('data-season') + ' season has ended. ' +
        'Next season’s schedule will be posted here when it is set.';
      ordered.appendChild(note);
    }

    /* A heading only appears when it has something under it: no "Earlier this
       season" before the season starts, no "Upcoming" once it has ended. */
    if (split.upcoming.length > 0) {
      ordered.appendChild(groupHeading('Upcoming'));
      split.upcoming.forEach(function (event, index) {
        tint(event);
        if (index === 0) flagAsNext(event.element);
        ordered.appendChild(event.element);
      });
    }
    if (split.past.length > 0) {
      ordered.appendChild(groupHeading('Earlier this season'));
      split.past.forEach(function (event) {
        tint(event);
        event.element.classList.add('is-past');
        ordered.appendChild(event.element);
      });
    }

    /* Appending moves the existing cards rather than copying them, so nothing
       is duplicated and nothing is thrown away. */
    list.appendChild(ordered);
  }

  function fillNextServiceBand() {
    var band = document.getElementById('next-service');
    if (!band || !window.fetch || !window.DOMParser) return;

    var eyebrow = band.querySelector('[data-ns="eyebrow"]');
    var headline = band.querySelector('[data-ns="headline"]');
    var meta = band.querySelector('[data-ns="meta"]');
    if (!eyebrow || !headline || !meta) return;

    /* fetch() cannot read a file:// page, so opening index.html straight off
       the disk leaves the standing sentence in place. That is the correct
       outcome, not a bug to work around. */
    fetch('events.html', { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('events.html responded ' + response.status);
        return response.text();
      })
      .then(function (markup) {
        var parsed = new DOMParser().parseFromString(markup, 'text/html');
        var next = partition(readEvents(parsed), new Date()).upcoming[0];
        /* Off season there is nothing truer to say than what is already
           written here, so say nothing. */
        if (!next || !next.title) return;
        eyebrow.textContent = 'Next service';
        headline.textContent = formatDate(next.date);
        meta.textContent = next.title + ' · 6:00 pm in the chapel';
      })
      .catch(function () {
        /* The markup the visitor is already looking at is true. Leave it. */
      });
  }

  orderEventsPage();
  fillNextServiceBand();
})();
